import { beforeEach, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { syncChangedDoorTarget } from "./doorTargetSync";
import { syncEmployeeDoorRights } from "./hikSyncEmployee";

const grants = vi.hoisted(() => vi.fn());
vi.mock("./grantStatus", async original => ({ ...await original<typeof import("./grantStatus")>(), upsertGrantStatus: grants }));
vi.mock("./doorTarget", () => ({ assertDeviceDoorTargets: vi.fn() }));

const projectId = "project" as Id<"projects">;
const device = { _id: "device" as Id<"devices">, _creationTime: 0, projectId, name: "Panel", brand: "hikvision" as const, hikDevIndex: "panel", createdAt: "", updatedAt: "" };
const door: Doc<"doors"> = { _id: "door" as Id<"doors">, _creationTime: 0, projectId, deviceId: device._id, name: "Kapı", hikDoorNo: 1 };
const person = (id: string, cardNumber: string): Doc<"employees"> => ({ _id: id as Id<"employees">, _creationTime: 0, projectId, firstName: id, lastName: "Kişi", cardNumber, email: "", isActive: true });
beforeEach(() => grants.mockClear());

it.each([false, true])("door edits skip cardless members without grants or queued person operations (withCard=%s)", async withCard => {
  const employees = [person("A", ""), person("B", "  "), ...(withCard ? [person("C", "00123")] : [])];
  const rule: Doc<"accessRules"> = { _id: "rule" as Id<"accessRules">, _creationTime: 0, projectId, name: "Kural" };
  const insert = vi.fn(async (table: string) => `${table}-id`);
  const patch = vi.fn();
  const schedule = vi.fn();
  const ctx = { db: { get: async () => device, insert, patch }, scheduler: { runAfter: schedule } } as unknown as MutationCtx;
  await syncChangedDoorTarget(ctx, { door, links: [], rules: [{ rule, employees, blanket: false, hasMembers: true, beforeDeviceIds: [device._id] }] }, { ...door, hikDoorNo: 2 }, "user" as Id<"users">);
  const operations = insert.mock.calls.filter(([table]) => table === "hikPendingOperations");
  expect(operations).toHaveLength(withCard ? 1 : 0);
  expect(grants).toHaveBeenCalledTimes(withCard ? 2 : 0);
  if (withCard) {
    expect(grants.mock.calls.every(call => call[1].employeeId === "C")).toBe(true);
    expect(operations[0]).toEqual(["hikPendingOperations", expect.objectContaining({ payload: expect.objectContaining({ employeeId: "C", cardNumber: "00123" }) })]);
  } else {
    expect(patch).toHaveBeenCalledWith("deviceSyncRunTargets-id", { status: "skipped", reason: "Etkilenen kişi yok" });
  }
});

it.each(["", " \t "])("rights-only retry exits before querying or writing any device for empty card %j", async cardNumber => {
  const runQuery = vi.fn(), runMutation = vi.fn(), runAction = vi.fn();
  const ctx = { runQuery, runMutation, runAction } as unknown as ActionCtx;
  expect(await syncEmployeeDoorRights(ctx, { employeeId: "A" as Id<"employees">, cardNumber, device })).toEqual({ ok: true });
  expect(runQuery).not.toHaveBeenCalled();
  expect(runMutation).not.toHaveBeenCalled();
  expect(runAction).not.toHaveBeenCalled();
});
