// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-10-27T12:00:00Z");
const future = "2026-10-28T12:00:00.000Z";
async function fixture(role: "admin" | "viewer" | "technician" = "admin", platformRole: "project_user" | "super_admin" = "project_user") {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Ziyaret" });
    const userId = await ctx.db.insert("users", { role: platformRole, verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Lobi", targetType: "visitor" });
    const visitorId = await ctx.db.insert("employees", { email: "", projectId, accessRuleId: ruleId,
      firstName: "İpek", lastName: "Yıldız", cardNumber: "12345678", isVisitor: true, isActive: true,
      visitorStatus: "checkedIn", accessExpiresAt: future, visitorPhone: "5551234567", notes: "Özel not", visitPurpose: "Görüşme" });
    return { projectId, userId, sessionId, visitorId, ruleId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
afterEach(() => vi.useRealTimers());

describe("visitor audit 2 lifecycle and permissions", () => {
  it("deactivation is checkedOut in storage, filtered list and summary", async () => {
    const f = await fixture();
    await f.caller.mutation(api.visitors.update, { visitorId: f.visitorId, isActive: false });
    expect(await f.t.run(ctx => ctx.db.get(f.visitorId))).toMatchObject({ isActive: false, visitorStatus: "checkedOut" });
    const page = await f.caller.query(api.visitors.listPage, { projectId: f.projectId, status: "checkedOut", paginationOpts: { numItems: 25, cursor: null } });
    expect(page.page).toMatchObject([{ _id: f.visitorId, status: "checkedOut" }]);
    expect(await f.caller.query(api.visitors.summary, { projectId: f.projectId })).toMatchObject({ counts: { checkedOut: 1, preRegistered: 0, active: 0 } });
  });
  it.each(["viewer", "admin"] as const)("%s sees only permitted contact fields in list and detail", async role => {
    const f = await fixture(role);
    const expected = role === "admin" ? { visitorPhone: "5551234567", notes: "Özel not", visitPurpose: "Görüşme" } : { visitorPhone: null, notes: null, visitPurpose: null };
    const page = await f.caller.query(api.visitors.listPage, { projectId: f.projectId, paginationOpts: { numItems: 25, cursor: null } });
    expect(page.page[0]).toMatchObject(expected);
    expect(await f.caller.query(api.visitors.getDetail, { visitorId: f.visitorId })).toMatchObject({ ...expected, sensitiveMasked: role !== "admin" });
    expect(await f.caller.query(api.visitors.summary, { projectId: f.projectId })).toMatchObject({ total: 1, overflow: false });
  });
  it("rejects a technical role at all three read endpoints", async () => {
    const f = await fixture("technician");
    await expect(f.caller.query(api.visitors.listPage, { projectId: f.projectId, paginationOpts: { numItems: 25, cursor: null } })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.query(api.visitors.summary, { projectId: f.projectId })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.query(api.visitors.getDetail, { visitorId: f.visitorId })).rejects.toThrow("yetkiniz yok");
  });
  it("preserves super-admin access independently of membership permissions", async () => {
    const f = await fixture("technician", "super_admin");
    expect(await f.caller.query(api.visitors.getDetail, { visitorId: f.visitorId })).toMatchObject({ sensitiveMasked: false, notes: "Özel not" });
    expect(await f.caller.query(api.visitors.summary, { projectId: f.projectId })).toMatchObject({ total: 1 });
  });
});

describe("visitor audit 2 bounded reads", () => {
  it("caps counts and finds the nearest expiry outside the counted prefix, past inactive history", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.visitorId, { isActive: false, visitorStatus: "checkedOut" });
      for (let i = 0; i < 2000; i++) await ctx.db.insert("employees", { email: "", projectId: f.projectId,
        firstName: "Eski", lastName: `${i}`, cardNumber: `old-${i}`, isVisitor: true, isActive: false,
        visitorStatus: "checkedOut", accessExpiresAt: new Date(now + 100).toISOString() });
      await ctx.db.insert("employees", { email: "", projectId: f.projectId, firstName: "Aktif", lastName: "Yeni", cardNumber: "late",
        isVisitor: true, isActive: true, visitorStatus: "checkedIn", accessExpiresAt: new Date(now + 1000).toISOString() });
    });
    const result = await f.caller.query(api.visitors.summary, { projectId: f.projectId });
    expect(result).toMatchObject({ overflow: true, limit: 2000, nextExpiry: now + 1000, nextExpiryScanLimited: false });
    expect(result.total).toBe(2000);
    expect(result.total).toBe(result.counts.checkedOut);
    expect(result.counts.active).toBe(0);
  });
  it("reports an expiry scan limit explicitly and preserves legacy TR and invitation boundaries", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.visitorId, { accessExpiresAt: "2026-10-27T15:00:02" });
      await ctx.db.insert("employees", { email: "", projectId: f.projectId, firstName: "Davet", lastName: "Yeni", cardNumber: "PRE:new",
        isVisitor: true, isActive: false, visitorStatus: "preRegistered", accessExpiresAt: "2026-10-27T15:00:01+03:00" });
    });
    expect(await f.caller.query(api.visitors.summary, { projectId: f.projectId })).toMatchObject({ nextExpiry: now + 1000, nextExpiryScanLimited: false });
    await f.t.run(async ctx => {
      for (let i = 0; i < 60; i++) await ctx.db.insert("employees", { email: "", projectId: f.projectId, firstName: "Aktif", lastName: `${i}`, cardNumber: `active-${i}`,
        isVisitor: true, isActive: true, visitorStatus: "checkedIn", accessExpiresAt: future });
    });
    expect(await f.caller.query(api.visitors.summary, { projectId: f.projectId })).toMatchObject({ nextExpiry: now + 1000, nextExpiryScanLimited: true });
  });
  it("returns a continuation for an empty bounded page and eventually finds the match", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 250; i++) await ctx.db.insert("employees", { email: "", projectId: f.projectId, firstName: "Başka", lastName: `${i}`,
        cardNumber: `other-${i}`, isVisitor: true, isActive: false, visitorStatus: "checkedOut" });
    });
    const args = { projectId: f.projectId, search: "İpek" };
    const first = await f.caller.query(api.visitors.listPage, { ...args, paginationOpts: { numItems: 25, cursor: null } });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    expect(first.continueCursor).toBeTruthy();
    const second = await f.caller.query(api.visitors.listPage, { ...args, paginationOpts: { numItems: 25, cursor: first.continueCursor } });
    expect(second.page).toMatchObject([{ _id: f.visitorId }]);
    expect(second.isDone).toBe(true);
  });
});

it("ZIY-01 hides the target ID from 24 card reconstruction probes", async () => {
  const f = await fixture("viewer");
  const probes = [
    ...Array.from({ length: 10 }, (_, i) => `${i}5678`),
    ...Array.from({ length: 10 }, (_, i) => `${i}45678`),
    "02345678", "12345678", "22345678", "32345678",
  ];
  expect(probes).toHaveLength(24);
  for (const search of probes) {
    const result = await f.caller.query(api.visitors.listPage, { projectId: f.projectId, search, paginationOpts: { numItems: 25, cursor: null } });
    expect(result.page.map(row => row._id)).not.toContain(f.visitorId);
  }
  expect((await f.caller.query(api.visitors.listPage, { projectId: f.projectId, search: "İpek", paginationOpts: { numItems: 25, cursor: null } })).page).toHaveLength(1);
});
it("ZIY-01 permits card search to a sensitive-field reader", async () => {
  const f = await fixture();
  expect((await f.caller.query(api.visitors.listPage, { projectId: f.projectId, search: "12345678", paginationOpts: { numItems: 25, cursor: null } })).page.map(row => row._id)).toEqual([f.visitorId]);
});
it.each(["2026-10-28T10:00:00Z", "2026-10-28T12:00:00Z"])("ZIY-02 rejects reversed/equal effective ranges on create/update: %s", async accessExpiresAt => {
  const f = await fixture();
  const accessStartsAt = "2026-10-28T15:00:00+03:00";
  await expect(f.caller.mutation(api.visitors.create, { projectId: f.projectId, firstName: "Yeni", lastName: "Ziyaretçi", cardNumber: "98765432", presetRuleId: f.ruleId, accessStartsAt, accessExpiresAt })).rejects.toThrow("başlangıcı bitişten önce");
  await f.t.run(ctx => ctx.db.patch(f.visitorId, { accessStartsAt, accessExpiresAt: "2026-10-29T12:00:00Z" }));
  await expect(f.caller.mutation(api.visitors.update, { visitorId: f.visitorId, accessExpiresAt })).rejects.toThrow("başlangıcı bitişten önce");
  expect((await f.t.run(ctx => ctx.db.get(f.visitorId)))?.accessExpiresAt).toBe("2026-10-29T12:00:00Z");
});
it("KIS-001 rejects a mixed visitor/employee batch atomically", async () => {
  const f = await fixture();
  const ids = await f.t.run(async ctx => ({
    departmentId: await ctx.db.insert("departments", { projectId: f.projectId, name: "Yeni" }),
    employeeId: await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "456789" }),
  }));
  await expect(f.caller.mutation(api.employees.bulkUpdateDepartment, { employeeIds: [ids.employeeId, f.visitorId], departmentId: ids.departmentId })).rejects.toThrow("Ziyaretçi");
  expect((await f.t.run(ctx => ctx.db.get(ids.employeeId)))?.departmentId).toBeUndefined();
  expect((await f.t.run(ctx => ctx.db.get(f.visitorId)))?.departmentId).toBeUndefined();
  await expect(f.caller.mutation(api.employees.bulkUpdateDepartment, { employeeIds: [ids.employeeId], departmentId: ids.departmentId })).resolves.toEqual({ updatedCount: 1 });
});
it("ALM-001 viewer permissions govern actual event serialization", async () => {
  const f = await fixture("viewer");
  await f.t.run(async ctx => {
    await ctx.db.insert("projectRolePermissions", { projectId: f.projectId, role: "viewer", permissions: ["reports.view"], updatedAt: now, updatedBy: f.userId });
    await ctx.db.insert("deviceEvents", { projectId: f.projectId, source: "hikvision", eventTime: future, category: "alarm", severity: "warning", label: "Alarm", cardNo: "12345678", rawData: "private", createdAt: future, updatedAt: future });
  });
  const result = await f.caller.query(api.alarms.list, { projectId: f.projectId, category: "alarm", status: "all", paginationOpts: { numItems: 25, cursor: null } });
  expect(result.page).toHaveLength(1);
  expect(result.page[0]).not.toHaveProperty("cardNo");
  expect(result.page[0]).not.toHaveProperty("rawData");
});
