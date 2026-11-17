// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { employeeAuditValues } from "./lib/auditPrivacy";
import { writeAudit } from "./lib/audit";
import { cascadeRemoveEmployeePII } from "./lib/employeeCascade";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("employee audit minimization", () => {
  it("keeps only changed operational fields and excludes profile, pay, credentials and notes", () => {
    const before = { firstName: "Ada", tcNo: "12345678900", email: "ada@example.test", cardNumber: "12345678", monthlySalary: 90000, notes: "Özel not", isActive: true, departmentId: "department" };
    expect(employeeAuditValues(before, { ...before, isActive: false }, "update")).toEqual({ oldValue: { isActive: true }, newValue: { isActive: false } });
    expect(employeeAuditValues(before, { isActive: false }, "update")).toEqual({ oldValue: { isActive: true }, newValue: { isActive: false } });
  });
  it("writes the minimized snapshot and search index atomically", async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => writeAudit(ctx, { user: null, action: "update", targetTable: "employees", targetId: "employee", oldValue: { firstName: "Ada", tcNo: "12345678900", isActive: true }, newValue: { firstName: "Ada", tcNo: "12345678900", isActive: false } }));
    const rows = await t.run(ctx => ctx.db.query("auditLog").collect());
    expect(rows[0]).toMatchObject({ oldValue: { isActive: true }, newValue: { isActive: false } });
    expect(JSON.stringify(rows)).not.toContain("12345678900");
    expect(rows[0].searchText).not.toContain("ada");
  });
  it("removes old copied values, notes and search names in bounded deletion batches", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Proje" });
      const id = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "1234" });
      for (let i = 0; i < 201; i++) await ctx.db.insert("auditLog", { projectId, targetTable: "employees", targetId: id, action: "update", timestamp: i,
        oldValue: { firstName: "Ada", cardNumber: "1234", notes: "Kişisel not", isActive: true }, newValue: { firstName: "Ada", cardNumber: "1234", isActive: false },
        note: "Ada kişisel not", searchText: "ada test" });
      return id;
    });
    const before = await t.run(ctx => ctx.db.query("auditLog").collect());
    await t.run(ctx => cascadeRemoveEmployeePII({ ...ctx, user: null }, employeeId));
    const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.some(job => job.name === "lib/employeeCascade:maskEmployeeAudit")).toBe(true);
    await t.mutation(internal.lib.employeeCascade.maskEmployeeAudit, { employeeId, afterTime: before[199]._creationTime });
    const rows = await t.run(ctx => ctx.db.query("auditLog").collect());
    expect(JSON.stringify(rows)).not.toContain("Kişisel not");
    expect(rows.every(row => !row.searchText?.includes("ada"))).toBe(true);
    expect(rows.filter(row => row.oldValue?.isActive === true)).toHaveLength(201);
  });
});
