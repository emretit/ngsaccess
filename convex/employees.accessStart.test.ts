// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { employeeWithinAccessEpoch } from "./lib/mobileAccess";

const modules = import.meta.glob("./**/*.ts");
async function fixture(role: "project_admin" | "project_user" = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    return { projectId, userId, sessionId };
  });
  return { t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), ...ids };
}
const person = { firstName: "Ada", lastName: "Test", email: "ada@test.example", cardNumber: "123" };
describe("employee access start", () => {
  it("normalizes create/update to Turkey midnight, audits, schedules Hik only and clears with null", async () => {
    const f = await fixture();
    const employeeId = await f.caller.mutation(api.employees.create, { projectId: f.projectId, ...person, accessStartsAt: "2026-11-01T00:00:00+03:00" });
    const employee = await f.t.run(ctx => ctx.db.get(employeeId));
    expect(employee?.accessStartsAt).toBe("2026-10-31T21:00:00.000Z");
    if (!employee) throw new Error("Missing created employee");
    const midnight = Date.parse("2026-10-31T21:00:00.000Z");
    expect(employeeWithinAccessEpoch(employee, midnight - 1)).toBe(false);
    expect(employeeWithinAccessEpoch(employee, midnight)).toBe(true);
    await f.caller.mutation(api.employees.update, { employeeId, accessStartsAt: "2026-11-02T12:30:00+03:00" });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.accessStartsAt).toBe("2026-11-01T21:00:00.000Z");
    await f.caller.mutation(api.employees.update, { employeeId, accessStartsAt: null });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.accessStartsAt).toBeUndefined();
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.map(job => job.name)).toEqual([
      "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels",
      "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/hikvisionSync:syncEmployeeToDevicesInternal",
    ]);
    const logs = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(logs).toHaveLength(3);
    expect(logs[2]).toMatchObject({ oldValue: { accessStartsAt: "2026-11-01T21:00:00.000Z" }, newValue: { accessStartsAt: null } });
    await f.caller.mutation(api.employees.update, { employeeId, accessStartsAt: null });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(4);
  });
  it.each(["garbage", "2026-02-30T00:00:00+03:00", "2026-11-01", ""])("rejects invalid ISO %s in create and update", async accessStartsAt => {
    const f = await fixture();
    await expect(f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, accessStartsAt })).rejects.toThrow("ISO");
    const employeeId = await f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, accessStartsAt: null });
    await expect(f.caller.mutation(api.employees.update, { employeeId, accessStartsAt })).rejects.toThrow("ISO");
  });
  it("does not change a visitor epoch or bypass employees.manage", async () => {
    const f = await fixture();
    const employeeId = await f.t.run(ctx => ctx.db.insert("employees", { ...person, projectId: f.projectId, isVisitor: true, accessStartsAt: "2026-11-01T11:00:00Z" }));
    for (const accessStartsAt of [null, "2026-11-02T00:00:00+03:00"]) {
      await expect(f.caller.mutation(api.employees.update, { employeeId, accessStartsAt })).rejects.toThrow("Ziyaretçi");
    }
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.accessStartsAt).toBe("2026-11-01T11:00:00Z");
    const restricted = await fixture("project_user");
    await expect(restricted.caller.mutation(api.employees.create, { ...person, projectId: restricted.projectId, accessStartsAt: null })).rejects.toThrow("yetkiniz");
    const restrictedId = await restricted.t.run(ctx => ctx.db.insert("employees", { ...person, projectId: restricted.projectId }));
    await expect(restricted.caller.mutation(api.employees.update, { employeeId: restrictedId, accessStartsAt: null })).rejects.toThrow("yetkiniz");
  });
});
