// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import * as permissions from "./lib/permissions";
import * as payVisibility from "./lib/payVisibility";
import { cascadeRemoveEmployeePII } from "./lib/employeeCascade";
import type { ProjectRole } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
async function fixture(role: ProjectRole = "hr") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const photoStorageId = await ctx.storage.store(new Blob(["old-photo"]));
    const photoUrl = await ctx.storage.getUrl(photoStorageId);
    if (!photoUrl) throw new Error("Missing photo");
    const employeeId = await ctx.db.insert("employees", {
      projectId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "12345",
      photoStorageId, photoUrl, isActive: true, hourlyRate: 10, monthlySalary: 100, terminationReason: "Reason",
    });
    return { projectId, otherProjectId, userId, sessionId, employeeId, photoStorageId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("K-05 profile photo lifecycle", () => {
  it("deletes the replaced file and retains the newly claimed file", async () => {
    const f = await fixture();
    const storageId = await f.t.run(async ctx => {
      const id = await ctx.storage.store(new Blob(["new-photo"]));
      await ctx.db.insert("pendingUploads", { storageId: id, userId: f.userId, createdAt: Date.now() });
      return id;
    });
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, photoStorageId: storageId });
    expect(await f.t.run(ctx => ctx.storage.getUrl(f.photoStorageId))).toBeNull();
    expect(await f.t.run(ctx => ctx.storage.getUrl(storageId))).not.toBeNull();
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.photoStorageId).toBe(storageId);
  });

  it.each(["photoUrl", "photoStorageId"] as const)("removes the old file when clearing %s", async field => {
    const f = await fixture();
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, [field]: null });
    expect(await f.t.run(ctx => ctx.storage.getUrl(f.photoStorageId))).toBeNull();
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.photoStorageId).toBeUndefined();
  });

  it.each(["update", "replace", "delete"] as const)("preserves a file referenced by another employee/visitor on %s", async mode => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("employees", {
      projectId: f.otherProjectId, firstName: "Shared", lastName: "Visitor", email: "", cardNumber: "OTHER",
      photoStorageId: f.photoStorageId, isVisitor: true,
    }));
    if (mode === "update") await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, photoStorageId: null });
    else if (mode === "replace") {
      const storageId = await f.t.run(async ctx => {
        const id = await ctx.storage.store(new Blob(["replacement"]));
        await ctx.db.insert("pendingUploads", { storageId: id, userId: f.userId, createdAt: Date.now() });
        return id;
      });
      await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, photoStorageId: storageId });
    } else await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    expect(await f.t.run(ctx => ctx.storage.getUrl(f.photoStorageId))).not.toBeNull();
  });

  it.each([false, true])("deletes unshared photos and tokens with employee/visitor removal (visitor=%s)", async isVisitor => {
    const f = await fixture(isVisitor ? "security" : "hr");
    await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { isVisitor });
      await ctx.db.insert("checkInTokens", { employeeId: f.employeeId, token: "used", usedAt: "2026-10-01", employeeName: "Ada", expiresAt: "2099-01-01", createdAt: "" });
    });
    if (isVisitor) await f.caller.mutation(api.visitors.removeVisitor, { visitorId: f.employeeId });
    else await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    expect(await f.t.run(ctx => ctx.storage.getUrl(f.photoStorageId))).toBeNull();
    expect(await f.t.run(ctx => ctx.db.query("checkInTokens").collect())).toEqual([]);
  });

  it("rejects unauthorized photo changes and deletion without removing storage", async () => {
    const f = await fixture("viewer");
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, photoStorageId: null })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.mutation(api.employees.remove, { employeeId: f.employeeId })).rejects.toThrow("yetkiniz yok");
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { projectId: f.otherProjectId }));
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, photoStorageId: null })).rejects.toThrow("yetkiniz yok");
    expect(await f.t.run(ctx => ctx.storage.getUrl(f.photoStorageId))).not.toBeNull();
  });
});

describe("K-08 list and bounded cascade", () => {
  it("calculates masking permissions once per project regardless of employee count", async () => {
    const f = await fixture("viewer");
    const manage = vi.spyOn(permissions, "hasPermission");
    const pay = vi.spyOn(payVisibility, "canSeePayInProject");
    const first = await f.caller.query(api.employees.list, { projectId: f.projectId });
    const manageCalls = manage.mock.calls.length;
    const payCalls = pay.mock.calls.length;
    expect(manageCalls).toBe(2);
    expect(manage.mock.calls.filter(call => call[3] === "employees.manage")).toHaveLength(1);
    expect(payCalls).toBe(1);
    expect(first[0]).toMatchObject({ hourlyRate: null, monthlySalary: null, departments: null, positions: null });
    expect(first[0].terminationReason).toBeUndefined();
    await f.t.run(async ctx => {
      const employee = await ctx.db.get(f.employeeId);
      if (!employee) throw new Error("Missing employee");
      const { _id, _creationTime, ...fields } = employee;
      for (let i = 0; i < 30; i++) await ctx.db.insert("employees", { ...fields, cardNumber: `OTHER-${i}` });
    });
    manage.mockClear(); pay.mockClear();
    expect(await f.caller.query(api.employees.list, { projectId: f.projectId })).toHaveLength(31);
    expect(manage).toHaveBeenCalledTimes(manageCalls);
    expect(pay).toHaveBeenCalledTimes(payCalls);
  });

  it("keeps masking decisions separate across projects in an unfiltered list", async () => {
    const f = await fixture("viewer");
    const otherId = await f.t.run(async ctx => {
      await ctx.db.insert("userProjects", { userId: f.userId, projectId: f.otherProjectId, role: "hr" });
      return ctx.db.insert("employees", {
        projectId: f.otherProjectId, firstName: "Other", lastName: "Test", email: "", cardNumber: "OTHER",
        hourlyRate: 50, terminationReason: "Visible",
      });
    });
    const rows = await f.caller.query(api.employees.list, {});
    expect(rows.find(row => row._id === f.employeeId)).toMatchObject({ hourlyRate: null });
    expect(rows.find(row => row._id === otherId)).toMatchObject({ hourlyRate: 50, terminationReason: "Visible" });
    await expect(f.caller.query(api.employees.list, { projectId: await f.t.run(ctx => ctx.db.insert("projects", { name: "Foreign" })) })).rejects.toThrow("erişim yetkiniz yok");
  });

  it("anonymizes 450 readings and deletes 450 QR tokens through scheduled batches", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 450; i++) {
        await ctx.db.insert("cardReadings", { employeeId: f.employeeId, cardNo: "12345", employeeName: "Ada", accessTime: `2026-10-01T00:00:00Z` });
        await ctx.db.insert("checkInTokens", { employeeId: f.employeeId, token: `qr-${i}`, employeeName: "Ada", expiresAt: "2099-01-01", createdAt: "" });
      }
      await ctx.db.insert("checkInTokens", { employeeId: await ctx.db.insert("employees", { firstName: "Other", lastName: "Test", email: "", cardNumber: "OTHER" }), token: "unrelated", expiresAt: "2099-01-01", createdAt: "" });
      const user = await ctx.db.get(f.userId);
      if (!user) throw new Error("Missing user");
      await cascadeRemoveEmployeePII({ ...ctx, user }, f.employeeId);
      await ctx.db.delete(f.employeeId);
    });
    const readings = () => f.t.run(ctx => ctx.db.query("cardReadings").collect());
    expect((await readings()).filter(row => row.employeeName === "[silindi]")).toHaveLength(200);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const rows = await readings();
    expect(rows).toHaveLength(450);
    expect(rows.every(row => row.employeeName === "[silindi]" && row.cardNo.startsWith("anon-"))).toBe(true);
    expect(new Set(rows.map(row => row.cardNo)).size).toBe(1);
    expect(await f.t.run(ctx => ctx.db.query("checkInTokens").collect())).toMatchObject([{ token: "unrelated" }]);
  });
});
