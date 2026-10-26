/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { buildPersonPayload, type PersonRecord } from "./lib/gateway/persons";

const wire = vi.hoisted(() => ({ person: vi.fn(async (_dev: string, _person: PersonRecord) => ({ ok: true })) }));
vi.mock("./lib/hikGateway", async original => ({
  ...await original<typeof import("./lib/hikGateway")>(),
  upsertPersonToDevice: wire.person,
  setWeekPlanOnDevice: vi.fn(async () => ({ ok: true })),
  setPlanTemplate: vi.fn(async () => ({ ok: true })),
  addCardToDevice: vi.fn(async () => ({ ok: true })),
}));
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T12:00:00Z")); });
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

type AccessEnd = { accessExpiresAt?: string; employmentEndDate?: string };
async function fixture(end: AccessEnd, transport: "gateway" | "localBridge" = "gateway") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Synthetic" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "End", lastName: "Test", email: "end@example.test", cardNumber: "123", isActive: true, ...end });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", hikDevIndex: "synthetic", hikTransport: transport, hikDoorCount: 1, hikLastSeenAt: Date.now(), isActive: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    const groupId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true, hikWeekPlanNo: 4 });
    await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, createdAt: "2026-01-01" });
    await ctx.db.insert("groupDevices", { projectId, groupId, deviceId, createdAt: "2026-01-01" });
    return { projectId, employeeId, deviceId };
  });
  return { t, ...ids };
}
const cases: [string, AccessEnd, string][] = [
  ["unlimited", {}, "2037-12-31T23:59:59"],
  ["visitor", { accessExpiresAt: "2026-10-26T15:00:00Z" }, "2026-10-26T18:00:00"],
  ["terminated", { employmentEndDate: "2026-10-31" }, "2026-10-31T23:59:59"],
  ["earliest", { accessExpiresAt: "2026-10-26T15:00:00Z", employmentEndDate: "2026-10-31" }, "2026-10-26T18:00:00"],
  ["expired", { accessExpiresAt: "2026-10-25T15:00:00Z" }, "2026-10-25T18:00:00"],
];

describe("F2b Hik access end propagation", () => {
  it.each(cases)("gateway sync writes %s validity", async (_label, end, expected) => {
    const f = await fixture(end);
    expect((await f.t.query(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: f.employeeId }))?.employee).toMatchObject(end);
    expect(await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.employeeId })).toMatchObject({ synced: 1, failed: 0 });
    const person = wire.person.mock.calls[0]?.[1];
    if (!person) throw new Error("Person payload missing");
    const valid = buildPersonPayload(person).Valid;
    expect(valid.endTime).toBe(expected);
    expect(valid.beginTime < valid.endTime).toBe(true);
  });
  it.each(cases)("retry rebuilds %s validity from current employee fields", async (_label, end, expected) => {
    const f = await fixture(end);
    const opId = await f.t.run(ctx => ctx.db.insert("hikPendingOperations", {
      projectId: f.projectId, deviceId: f.deviceId, operation: "addPerson", status: "failed", attemptCount: 1, createdAt: Date.now(),
      payload: { employeeId: f.employeeId, planTemplateNo: 4, endTime: "2037-12-31T23:59:59" },
    }));
    expect(await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {})).toMatchObject({ retried: 1, ok: 1, failed: 0 });
    const person = wire.person.mock.calls[0]?.[1];
    if (!person) throw new Error("Retry payload missing");
    expect(buildPersonPayload(person).Valid.endTime).toBe(expected);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "done" });
  });
  it.each(cases.slice(1, 4))("Windows bridge queues %s endTime", async (_label, end, expected) => {
    const f = await fixture(end, "localBridge");
    expect(await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.employeeId })).toMatchObject({ synced: 1, failed: 0 });
    const ops = await f.t.run(ctx => ctx.db.query("hikPendingOperations").take(10));
    expect(ops.find(op => op.operation === "addPerson")?.payload).toMatchObject({ endTime: expected });
    expect(wire.person).not.toHaveBeenCalled();
  });
});
