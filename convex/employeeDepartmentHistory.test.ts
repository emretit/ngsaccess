// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import migrationsTest from "@convex-dev/migrations/test";
import { recordDepartmentChange, departmentAt } from "./lib/employeeDepartmentHistory";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T10:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  migrationsTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Proje" });
    const companyId = await ctx.db.insert("companies", { name: "Şirket", projectId });
    const a = await ctx.db.insert("departments", { projectId, companyId, name: "A" });
    const b = await ctx.db.insert("departments", { projectId, companyId, name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_admin", verified: true });
    await ctx.db.insert("userProjects", { projectId, userId, role: "admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const employeeId = await ctx.db.insert("employees", { projectId, companyId, departmentId: a, firstName: "Ada", lastName: "Test", email: "", cardNumber: "1234", isActive: true });
    return { projectId, a, b, employeeId, userId, sessionId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
it("preserves the legacy baseline and records daily department moves, including clearing", async () => {
  const f = await fixture();
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, departmentId: f.b });
  vi.setSystemTime(new Date("2026-11-12T10:00:00Z"));
  await f.t.run(async ctx => {
    const previous = await ctx.db.get(f.employeeId);
    if (!previous) throw new Error("Kişi bulunamadı");
    await ctx.db.patch(f.employeeId, { departmentId: undefined });
    await recordDepartmentChange(ctx, f.employeeId, previous);
  });
  const state = await f.t.run(async ctx => ({ employee: await ctx.db.get(f.employeeId), history: await ctx.db.query("employeeDepartmentHistory").collect() }));
  if (!state.employee) throw new Error("Kişi bulunamadı");
  expect(departmentAt(state.employee, "2026-11-10", state.history)).toBe(f.a);
  expect(departmentAt(state.employee, "2026-11-11", state.history)).toBe(f.b);
  expect(departmentAt(state.employee, "2026-11-12", state.history)).toBeUndefined();
});
it("updates the same day's membership instead of creating ambiguous duplicates", async () => {
  const f = await fixture();
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, departmentId: f.b });
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, departmentId: f.a });
  const rows = await f.t.run(ctx => ctx.db.query("employeeDepartmentHistory").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find(row => row.validFrom === "2026-11-11")?.departmentId).toBe(f.a);
});
it("the migration batch is idempotent and leaves existing dated history intact", async () => {
  const f = await fixture();
  await f.t.mutation(internal.dataMigrations.backfillEmployeeDepartments, { oneBatchOnly: true, dryRun: false, cursor: null });
  await f.t.mutation(internal.dataMigrations.backfillEmployeeDepartments, { oneBatchOnly: true, dryRun: false, cursor: null });
  const rows = await f.t.run(ctx => ctx.db.query("employeeDepartmentHistory").collect());
  expect(rows).toMatchObject([{ employeeId: f.employeeId, departmentId: f.a, validFrom: "0001-01-01", source: "baseline" }]);
});
it("a dry run never writes a department baseline", async () => {
  const f = await fixture();
  await expect(f.t.mutation(internal.dataMigrations.backfillEmployeeDepartments, { oneBatchOnly: true, dryRun: true, cursor: null })).rejects.toMatchObject({ data: { kind: "DRY RUN" } });
  expect(await f.t.run(ctx => ctx.db.query("employeeDepartmentHistory").collect())).toHaveLength(0);
});
