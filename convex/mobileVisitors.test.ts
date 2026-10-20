// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
const create = makeFunctionReference<"mutation">("mobileVisitors:create");
const update = makeFunctionReference<"mutation">("mobileVisitors:update");
const cancel = makeFunctionReference<"mutation">("mobileVisitors:cancel");
const listPage = makeFunctionReference<"query">("mobileVisitors:listPage");
const detail = makeFunctionReference<"query">("mobileVisitors:detail");
const checkOut = makeFunctionReference<"mutation">("visitors:checkOut");
const releaseCard = makeFunctionReference<"mutation">("visitors:releaseCard");
const webCreate = makeFunctionReference<"mutation">("visitors:create");
const webUpdate = makeFunctionReference<"mutation">("visitors:update");

const input = {
  firstName: "Synthetic", lastName: "Visitor", visitorPhone: "+900000000000", visitPurpose: "Synthetic visit",
  visitStart: "2030-01-01T10:00:00Z", visitEnd: "2030-01-01T11:00:00Z", noticeReviewed: false,
  requestId: "11111111-1111-4111-8111-111111111111",
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectA = await ctx.db.insert("projects", { name: "Synthetic A" });
    const projectB = await ctx.db.insert("projects", { name: "Synthetic B" });
    const host = await ctx.db.insert("employees", { projectId: projectA, firstName: "Host", lastName: "A", email: "host-a@example.test", cardNumber: "host-a", isActive: true });
    const other = await ctx.db.insert("employees", { projectId: projectA, firstName: "Other", lastName: "A", email: "other-a@example.test", cardNumber: "other-a", isActive: true });
    const foreign = await ctx.db.insert("employees", { projectId: projectB, firstName: "Foreign", lastName: "B", email: "foreign-b@example.test", cardNumber: "foreign-b", isActive: true });
    for (const [employeeId, token] of [[host, "host-session"], [other, "other-session"], [foreign, "foreign-session"]] as const) {
      await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "synthetic-test-hash", updatedAt: "2026-10-19T00:00:00Z", createdAt: "2026-10-19T00:00:00Z" });
      await ctx.db.insert("employeeSessions", { employeeId, token, expiresAt: "2035-01-01T00:00:00Z", createdAt: "2026-10-19T00:00:00Z" });
    }
    const adminId = await ctx.db.insert("users", { role: "project_admin", email: "admin@example.test" });
    await ctx.db.insert("userProjects", { userId: adminId, projectId: projectA });
    const sessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    return { projectA, projectB, host, other, foreign, adminId, sessionId };
  });
  const admin = t.withIdentity({ subject: `${ids.adminId}|${ids.sessionId}` });
  return { t, admin, ...ids };
}

async function created(t: Awaited<ReturnType<typeof setup>>["t"]) {
  const result: { id: Id<"employees"> } = await t.mutation(create, { ...input, sessionToken: "host-session" });
  return result.id;
}

describe("employee invitation capability through real auth wrappers", () => {
  it("writes a real web-visible inactive preregistration without card grants or device jobs", async () => {
    const { t, projectA, host } = await setup();
    const id = await created(t);
    const row = await t.run(ctx => ctx.db.get(id));
    expect(row).toMatchObject({ projectId: projectA, hostEmployeeId: host, isVisitor: true, isActive: false, visitorStatus: "preRegistered" });
    expect(row?.cardNumber).toMatch(/^PRE:[0-9a-f-]{36}$/);
    expect(row?.accessRuleId).toBeUndefined();
    expect(await t.run(ctx => ctx.db.query("groupMembers").take(10))).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toHaveLength(0);
    const page = await t.query(listPage, { sessionToken: "host-session", paginationOpts: { numItems: 20, cursor: null } });
    expect(page.page).toHaveLength(1);
    expect(Object.keys(page.page[0]).sort()).toEqual(["id", "firstName", "lastName", "visitStart", "visitEnd", "status", "canEdit"].sort());
  });

  it("deduplicates the same intent and rejects changed payloads or client-supplied privileges", async () => {
    const { t } = await setup();
    const ids = await Promise.all(Array.from({ length: 8 }, () => t.mutation(create, { ...input, sessionToken: "host-session" })));
    expect(new Set(ids.map(result => result.id)).size).toBe(1);
    expect(await t.run(ctx => ctx.db.query("employees").withIndex("by_visitor", q => q.eq("isVisitor", true)).take(10))).toHaveLength(1);
    await expect(t.mutation(create, { ...input, visitPurpose: "Different intent", sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "REQUEST_CONFLICT" } });
    await expect(t.mutation(create, { ...input, isActive: true, sessionToken: "host-session" })).rejects.toThrow();
  });

  it("isolates same-project hosts and foreign tenants, with no unauthorized writes", async () => {
    const { t } = await setup();
    const id = await created(t);
    for (const sessionToken of ["other-session", "foreign-session"]) {
      const before = await t.run(ctx => ctx.db.get(id));
      await expect(t.query(detail, { sessionToken, visitorId: id })).rejects.toMatchObject({ data: { code: "ACCESS_DENIED" } });
      await expect(t.mutation(update, { firstName: input.firstName, lastName: input.lastName, visitorPhone: input.visitorPhone, visitPurpose: input.visitPurpose, visitStart: input.visitStart, visitEnd: input.visitEnd, sessionToken, visitorId: id })).rejects.toThrow();
      await expect(t.mutation(cancel, { sessionToken, visitorId: id })).rejects.toMatchObject({ data: { code: "ACCESS_DENIED" } });
      expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
      expect((await t.query(listPage, { sessionToken, paginationOpts: { numItems: 20, cursor: null } })).page).toEqual([]);
    }
  });

  it("edits only preregistrations and reports operator-required without touching activated access", async () => {
    const { t } = await setup();
    const id = await created(t);
    const { requestId: _requestId, noticeReviewed: _reviewed, ...fields } = input;
    await t.mutation(update, { ...fields, firstName: "Changed", visitorId: id, sessionToken: "host-session" });
    expect((await t.query(detail, { visitorId: id, sessionToken: "host-session" })).firstName).toBe("Changed");
    await t.run(ctx => ctx.db.patch(id, { isActive: true, visitorStatus: "checkedIn", cardNumber: "123456" }));
    const before = await t.run(ctx => ctx.db.get(id));
    await expect(t.mutation(update, { ...fields, visitorId: id, sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "VISITOR_LOCKED" } });
    expect(await t.mutation(cancel, { visitorId: id, sessionToken: "host-session" })).toEqual({ status: "operatorRequired" });
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
  });

  it("cancels inactive preregistrations idempotently without pretending physical exit", async () => {
    const { t } = await setup();
    const id = await created(t);
    for (let i = 0; i < 2; i++) expect(await t.mutation(cancel, { visitorId: id, sessionToken: "host-session" })).toEqual({ status: "cancelled" });
    expect(await t.query(detail, { visitorId: id, sessionToken: "host-session" })).toMatchObject({ status: "checkedOut", presence: "unknown", canEdit: false });
  });

  it("snapshots current configured notice review without fabricating visitor consent", async () => {
    const { t, projectA } = await setup();
    await t.run(ctx => ctx.db.insert("projectPrivacySettings", { projectId: projectA, visitorKvkkUrl: "https://example.test/notice", visitorKvkkVersion: "v2", updatedAt: "2026-10-19T00:00:00Z" }));
    await expect(t.mutation(create, { ...input, sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "VISITOR_NOTICE_CHANGED" } });
    await expect(t.mutation(create, { ...input, noticeReviewed: true, noticeVersion: "v1", sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "VISITOR_NOTICE_CHANGED" } });
    const result = await t.mutation(create, { ...input, noticeReviewed: true, noticeVersion: "v2", sessionToken: "host-session" });
    expect(await t.query(detail, { visitorId: result.id, sessionToken: "host-session" })).toMatchObject({ noticeUrl: "https://example.test/notice", noticeVersion: "v2" });
    expect(await t.run(ctx => ctx.db.query("employeeConsents").take(10))).toEqual([]);
  });

  it("rejects malformed dates, expired session and host reassignment without leaking contact data", async () => {
    const { t, other } = await setup();
    await expect(t.mutation(create, { ...input, visitStart: "2030-01-01T10:00", sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "VISITOR_INVALID" } });
    await expect(t.mutation(create, { ...input, visitEnd: input.visitStart, sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "VISITOR_INVALID" } });
    await expect(t.mutation(create, { ...input, sessionToken: "missing" })).rejects.toMatchObject({ data: { code: "SESSION_INVALID" } });
    const id = await created(t);
    await t.run(ctx => ctx.db.patch(id, { hostEmployeeId: other }));
    await expect(t.query(detail, { visitorId: id, sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "ACCESS_DENIED" } });
  });
});

describe("web orphan guards through real admin auth", () => {
  it.each(["orphan", "foreign", "admin-without-project"] as const)("denies %s checkOut and releaseCard before any write", async kind => {
    const { t, admin, projectA, projectB, adminId } = await setup();
    if (kind === "admin-without-project") {
      await t.run(async ctx => {
        const memberships = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", adminId)).take(10);
        for (const membership of memberships) await ctx.db.delete(membership._id);
      });
    }
    const id = await t.run(ctx => ctx.db.insert("employees", {
      ...(kind === "foreign" ? { projectId: projectB } : kind === "admin-without-project" ? { projectId: projectA } : {}), firstName: "Synthetic", lastName: "Visitor",
      email: "visitor@example.test", cardNumber: "234567", isVisitor: true, isActive: true,
    }));
    const before = await t.run(ctx => ctx.db.get(id));
    await expect(admin.mutation(checkOut, { visitorId: id })).rejects.toThrow("projesine erişim");
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    await t.run(ctx => ctx.db.patch(id, { isActive: false }));
    const inactive = await t.run(ctx => ctx.db.get(id));
    await expect(admin.mutation(releaseCard, { visitorId: id })).rejects.toThrow("projesine erişim");
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(inactive);
    expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toEqual([]);
  });

  it("rejects activation of a mobile placeholder until an operator assigns a real card", async () => {
    const { t, admin, projectA } = await setup();
    const id = await created(t);
    const rule = await t.run(ctx => ctx.db.insert("accessRules", { projectId: projectA, name: "Synthetic visitor zone", targetType: "visitor" }));
    await t.run(ctx => ctx.db.patch(id, { accessRuleId: rule }));
    await expect(admin.mutation(webUpdate, { visitorId: id, isActive: true })).rejects.toThrow("kart numarası");
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ isActive: false, visitorStatus: "preRegistered" });
  });

  it("activates a mobile preregistration only with a real card and same-project visitor preset", async () => {
    vi.useFakeTimers();
    const { t, admin, projectA, projectB } = await setup();
    const id = await created(t);
    const rules = await t.run(async ctx => ({
      own: await ctx.db.insert("accessRules", { name: "Visitor A", targetType: "visitor", projectId: projectA }),
      foreign: await ctx.db.insert("accessRules", { name: "Visitor B", targetType: "visitor", projectId: projectB }),
      employee: await ctx.db.insert("accessRules", { name: "Employee A", targetType: "employee", projectId: projectA }),
    }));
    const before = await t.run(ctx => ctx.db.get(id));
    for (const patch of [
      { isActive: true, cardNumber: "123456" },
      { isActive: true, presetRuleId: rules.own },
      { isActive: true, presetRuleId: rules.foreign, cardNumber: "123456" },
      { isActive: true, presetRuleId: rules.employee, cardNumber: "123456" },
    ]) {
      await expect(admin.mutation(webUpdate, { visitorId: id, ...patch })).rejects.toThrow();
      expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
      expect(await t.run(ctx => ctx.db.query("groupMembers").take(10))).toEqual([]);
      expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toEqual([]);
    }
    expect(await admin.mutation(webUpdate, { visitorId: id, presetRuleId: rules.own, cardNumber: "123456", isActive: true })).toBe(id);
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ cardNumber: "123456", accessRuleId: rules.own, isActive: true, visitorStatus: "checkedIn" });
    expect(await t.run(ctx => ctx.db.query("groupMembers").take(10))).toMatchObject([{ employeeId: id, projectId: projectA, groupId: rules.own }]);
    expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toHaveLength(2);
    // Existing assignments are fixed, including attempts to replace an active rule.
    await expect(admin.mutation(webUpdate, { visitorId: id, presetRuleId: rules.own })).rejects.toThrow("yalnız mobil ön kayıt");
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  });

});


describe("operator visitor card compatibility before device queueing", () => {
  it.each(["device", "door"] as const)("validates IDE %s targets before create and update writes", async link => {
    vi.useFakeTimers();
    const { t, admin, projectA } = await setup();
    const preset = await t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: projectA, name: "IDE visitor zone", targetType: "visitor", isActive: true });
      const deviceId = await ctx.db.insert("devices", { projectId: projectA, name: "Synthetic IDE", brand: "ide_smart", isActive: true, createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z" });
      if (link === "device") {
        await ctx.db.insert("groupDevices", { projectId: projectA, groupId: ruleId, deviceId, createdAt: "2026-10-19T00:00:00Z" });
      } else {
        const doorId = await ctx.db.insert("doors", { projectId: projectA, name: "Synthetic door", deviceId });
        await ctx.db.insert("groupDoors", { projectId: projectA, groupId: ruleId, doorId, createdAt: "2026-10-19T00:00:00Z" });
      }
      return ruleId;
    });
    const id = await created(t);
    const before = await t.run(ctx => ctx.db.get(id));
    const createArgs = { projectId: projectA, firstName: "Synthetic", lastName: "IDE", presetRuleId: preset, accessExpiresAt: "2030-01-01T11:00:00Z" };
    for (const cardNumber of ["0", "-1", "NaN", "ABC", "0x10", "1e3", "00123", "9007199254740992"]) {
      await expect(admin.mutation(webCreate, { ...createArgs, cardNumber })).rejects.toThrow("IDE kartı");
      await expect(admin.mutation(webUpdate, { visitorId: id, presetRuleId: preset, cardNumber, isActive: true })).rejects.toThrow("IDE kartı");
      expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
      expect(await t.run(ctx => ctx.db.query("employees").withIndex("by_visitor", q => q.eq("isVisitor", true)).take(10))).toHaveLength(1);
      expect(await t.run(ctx => ctx.db.query("groupMembers").take(10))).toEqual([]);
      expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toEqual([]);
    }
    const activated = await admin.mutation(webUpdate, { visitorId: id, presetRuleId: preset, cardNumber: "9007199254740991", isActive: true });
    expect(activated).toBe(id);
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ cardNumber: "9007199254740991", isActive: true });
    // This verifies atomic queue admission, not delivery to a physical panel.
    await t.run(async ctx => {
      for (const job of await ctx.db.system.query("_scheduled_functions").take(10)) await ctx.scheduler.cancel(job._id);
    });
  });

  it("preserves legitimate non-IDE card strings instead of imposing an IDE numeric format", async () => {
    vi.useFakeTimers();
    const { t, admin, projectA } = await setup();
    const preset = await t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: projectA, name: "Hik visitor zone", targetType: "visitor", isActive: true });
      const deviceId = await ctx.db.insert("devices", { projectId: projectA, name: "Synthetic Hikvision", brand: "hikvision", isActive: true, createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z" });
      await ctx.db.insert("groupDevices", { projectId: projectA, groupId: ruleId, deviceId, createdAt: "2026-10-19T00:00:00Z" });
      return ruleId;
    });
    const id = await admin.mutation(webCreate, { projectId: projectA, firstName: "Synthetic", lastName: "Hikvision",
      presetRuleId: preset, cardNumber: "00ABC123", accessExpiresAt: "2030-01-01T11:00:00Z" });
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ cardNumber: "00ABC123", isActive: true });
    await admin.mutation(webUpdate, { visitorId: id, cardNumber: "000123" });
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ cardNumber: "000123" });
    await t.run(async ctx => {
      for (const job of await ctx.db.system.query("_scheduled_functions").take(20)) await ctx.scheduler.cancel(job._id);
    });
  });
});


it("allows an operator to renew an expired inactive mobile preregistration atomically", async () => {
  vi.useFakeTimers();
  const { t, admin, projectA } = await setup();
  const id = await created(t);
  await t.run(ctx => ctx.db.patch(id, { accessExpiresAt: "2020-01-01T00:00:00Z" }));
  const presetRuleId = await t.run(ctx => ctx.db.insert("accessRules", { projectId: projectA, name: "Visitor", targetType: "visitor" }));
  expect(await t.query(detail, { visitorId: id, sessionToken: "host-session" })).toMatchObject({ status: "expired", canEdit: true });
  await expect(admin.mutation(webUpdate, { visitorId: id, presetRuleId, cardNumber: "123456", isActive: true })).rejects.toThrow("gelecekte");
  await admin.mutation(webUpdate, { visitorId: id, presetRuleId, cardNumber: "123456", isActive: true, accessExpiresAt: "2030-01-01T11:00:00Z" });
  expect(await t.query(detail, { visitorId: id, sessionToken: "host-session" })).toMatchObject({ status: "active", canEdit: false });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

const summary = makeFunctionReference<"query">("mobileVisitors:summary");
const expire = makeFunctionReference<"mutation">("visitors:expireVisitorAccess");

describe("bounded host invitation search, lifecycle filters and independent summary", () => {
  it("finds Turkish names beyond the first scan window and binds cursors to their host and filters", async () => {
    vi.useFakeTimers();
    const { t, projectA, host } = await setup();
    const id = await created(t);
    await t.run(ctx => ctx.db.patch(id, { firstName: "İpek", lastName: "IŞIL" }));
    vi.advanceTimersByTime(1000);
    await t.run(async ctx => {
      for (let i = 0; i < 205; i++) await ctx.db.insert("employees", { projectId: projectA, hostEmployeeId: host,
        firstName: "Other", lastName: `Synthetic${i}`, email: `synthetic-${i}@example.test`, cardNumber: `PRE:synthetic-${i}`,
        isVisitor: true, isActive: false, visitorStatus: "preRegistered", mobileVisitorRequestId: `synthetic-${i}`,
        accessStartsAt: input.visitStart, accessExpiresAt: input.visitEnd });
    });
    const first = await t.query(listPage, { sessionToken: "host-session", search: "İPEK ışıl", paginationOpts: { numItems: 20, cursor: null } });
    expect(first).toMatchObject({ page: [], isDone: false, scanLimited: true });
    const second = await t.query(listPage, { sessionToken: "host-session", search: "ipek IŞIL", paginationOpts: { numItems: 20, cursor: first.continueCursor } });
    expect(second.page).toMatchObject([{ id, firstName: "İpek", lastName: "IŞIL" }]);
    await expect(t.query(listPage, { sessionToken: "host-session", search: "other", paginationOpts: { numItems: 20, cursor: first.continueCursor } })).rejects.toMatchObject({ data: { code: "VISITOR_INVALID" } });
    await expect(t.query(listPage, { sessionToken: "other-session", search: "İPEK ışıl", paginationOpts: { numItems: 20, cursor: first.continueCursor } })).rejects.toMatchObject({ data: { code: "VISITOR_INVALID" } });
    expect(await t.query(summary, { sessionToken: "host-session" })).toMatchObject({ total: 206, overflow: false, counts: { preRegistered: 206 } });
  });

  it("uses four administrative lifecycle states without counting physical presence", async () => {
    const { t, projectA, host } = await setup();
    await created(t);
    await t.run(async ctx => {
      for (const [status, isActive, expiry] of [["checkedIn", true, input.visitEnd], ["checkedOut", false, input.visitEnd], ["preRegistered", false, "2020-01-01T00:00:00Z"]] as const) {
        await ctx.db.insert("employees", { projectId: projectA, hostEmployeeId: host, firstName: "Synthetic", lastName: status,
          email: `${status}-${isActive}@example.test`, cardNumber: `PRE:${status}-${isActive}`, mobileVisitorRequestId: `${status}-${isActive}`,
          isVisitor: true, isActive, visitorStatus: status, accessStartsAt: input.visitStart, accessExpiresAt: expiry });
      }
    });
    const counts = { active: 1, preRegistered: 1, checkedOut: 1, expired: 1 };
    expect(await t.query(summary, { sessionToken: "host-session" })).toMatchObject({ total: 4, counts, overflow: false });
    for (const status of ["active", "preRegistered", "checkedOut", "expired"]) {
      const page = await t.query(listPage, { sessionToken: "host-session", status, paginationOpts: { numItems: 1, cursor: null } });
      expect(page.page).toHaveLength(1);
      expect(page.page[0].status).toBe(status);
      expect(await t.query(summary, { sessionToken: "host-session" })).toMatchObject({ total: 4, counts });
    }
  });

  it("reports a bounded lower-bound summary instead of presenting a truncated count as exact", async () => {
    const { t, projectA, host } = await setup();
    await t.run(async ctx => {
      for (let i = 0; i < 1002; i++) await ctx.db.insert("employees", { projectId: projectA, hostEmployeeId: host,
        firstName: "Synthetic", lastName: "Visitor", email: `${i}@example.test`, cardNumber: `PRE:${i}`,
        isVisitor: true, isActive: false, visitorStatus: "preRegistered", mobileVisitorRequestId: `bounded-${i}`,
        accessStartsAt: input.visitStart, accessExpiresAt: input.visitEnd });
    });
    expect(await t.query(summary, { sessionToken: "host-session" })).toMatchObject({ total: 1000, counts: { preRegistered: 1000 }, overflow: true, scanned: 1000, limit: 1000 });
  });
});

async function syncFixture(brand: "ide_smart" | "hikvision") {
  const result = await setup();
  const { t, projectA, host } = result;
  const id = await created(t);
  const deviceId = await t.run(async ctx => {
    const ruleId = await ctx.db.insert("accessRules", { projectId: projectA, name: "Synthetic", isActive: true, targetType: "visitor" });
    const deviceId = await ctx.db.insert("devices", { projectId: projectA, name: "Synthetic", brand, isActive: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await ctx.db.insert("groupMembers", { projectId: projectA, employeeId: id, groupId: ruleId, createdAt: new Date().toISOString() });
    await ctx.db.insert("groupDevices", { projectId: projectA, groupId: ruleId, deviceId, createdAt: new Date().toISOString() });
    await ctx.db.patch(id, { isActive: true, cardNumber: "123456", visitorStatus: "checkedIn", accessRuleId: ruleId });
    return deviceId;
  });
  return { ...result, id, deviceId, host };
}

describe("own visitor device synchronization evidence", () => {
  it("reports pending, failed and applied only from a current IDE user operation acknowledgement", async () => {
    const { t, projectA, id, deviceId } = await syncFixture("ide_smart");
    const query = () => t.query(detail, { visitorId: id, sessionToken: "host-session" });
    expect((await query()).sync.status).toBe("unknown"); // DB active is no device evidence.
    const now = Date.now();
    const permissionId = await t.run(ctx => ctx.db.insert("idePendingOperations", { projectId: projectA, deviceId,
      opType: "upsertPermission", payload: { permissionRecord: { id: 1 } }, status: "acked", attempts: 1, ackedAt: now + 1, idempotencyKey: "synthetic-permission", createdAt: now }));
    const opId = await t.run(ctx => ctx.db.insert("idePendingOperations", { projectId: projectA, deviceId,
      opType: "upsertUser", payload: { userRecord: { id: 123456, status: 1, permissions: [1] } }, status: "pending", attempts: 0, idempotencyKey: "synthetic", createdAt: now }));
    expect((await query()).sync.status).toBe("pending");
    await t.run(ctx => ctx.db.patch(opId, { status: "sent" }));
    expect((await query()).sync.status).toBe("pending");
    await t.run(ctx => ctx.db.patch(opId, { status: "failed", lastError: "SYNTHETIC_PRIVATE_ERROR" }));
    const failed = await query();
    expect(failed.sync.status).toBe("failed");
    expect(JSON.stringify(failed.sync)).not.toContain("SYNTHETIC_PRIVATE_ERROR");
    await t.run(ctx => ctx.db.patch(opId, { status: "acked", ackedAt: now + 1 }));
    expect((await query()).sync).toMatchObject({ status: "applied", bounded: false });
    await t.run(ctx => ctx.db.patch(id, { accessExpiresAt: "2020-01-01T00:00:00Z" }));
    expect((await query()).sync.status).toBe("unknown"); // Old grant acknowledgement cannot prove expiry revocation.
    await t.run(ctx => ctx.db.patch(id, { accessExpiresAt: input.visitEnd }));
    expect(Object.keys((await query()).sync).sort()).toEqual(["status", "observedAt", "bounded"].sort());
    await t.run(ctx => ctx.db.patch(permissionId, { status: "failed" }));
    expect((await query()).sync.status).toBe("failed");
    await t.run(ctx => ctx.db.patch(permissionId, { status: "acked" }));
    await t.run(ctx => ctx.db.patch(opId, { createdAt: now - 60000 }));
    expect((await query()).sync.status).toBe("unknown");
  });

  it("does not treat Hikvision sent/done as device applied and never exposes another visitor operation", async () => {
    const { t, projectA, projectB, id, deviceId, other } = await syncFixture("hikvision");
    const opId = await t.run(ctx => ctx.db.insert("hikPendingOperations", { projectId: projectA, deviceId,
      operation: "addPerson", payload: { employeeId: other }, status: "done", attemptCount: 1, createdAt: Date.now() }));
    const query = () => t.query(detail, { visitorId: id, sessionToken: "host-session" });
    expect((await query()).sync.status).toBe("unknown");
    await t.run(ctx => ctx.db.patch(opId, { payload: { employeeId: id }, status: "pending" }));
    expect((await query()).sync.status).toBe("pending");
    await t.run(ctx => ctx.db.patch(opId, { status: "done" }));
    expect((await query()).sync.status).toBe("unknown");
    await t.run(ctx => ctx.db.patch(opId, { status: "failed", projectId: projectB }));
    expect((await query()).sync.status).toBe("unknown");
  });
});

it("expires a bounded batch and schedules cursor continuation until all expired visitors are processed", async () => {
  vi.useFakeTimers();
  const { t, projectA } = await setup();
  await t.run(async ctx => {
    for (let i = 0; i < 55; i++) await ctx.db.insert("employees", { projectId: projectA, firstName: "Synthetic", lastName: "Expired",
      email: `expired-${i}@example.test`, cardNumber: `${i + 1}`, isVisitor: true, isActive: true,
      visitorStatus: "checkedIn", accessExpiresAt: "2020-01-01T00:00:00Z" });
  });
  expect(await t.mutation(expire, {})).toEqual({ expired: 50 });
  expect((await t.run(ctx => ctx.db.query("employees").withIndex("by_visitor", q => q.eq("isVisitor", true)).take(60))).filter(row => row.isActive)).toHaveLength(5);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect((await t.run(ctx => ctx.db.query("employees").withIndex("by_visitor", q => q.eq("isVisitor", true)).take(60))).filter(row => row.isActive)).toHaveLength(0);
});

describe("optional host contact and notes updates", () => {
  it("creates without phone, canonicalizes empty/null idempotency intent, and never leaks notes in lists", async () => {
    const { t } = await setup();
    const first = await t.mutation(create, { ...input, visitorPhone: null, notes: null, sessionToken: "host-session" });
    expect(await t.mutation(create, { ...input, visitorPhone: "  ", notes: "  ", sessionToken: "host-session" })).toMatchObject({ id: first.id, replayed: true });
    const row = await t.run(ctx => ctx.db.get("employees", first.id));
    expect(row?.visitorPhone).toBeUndefined();
    expect(row?.notes).toBeUndefined();
    expect(await t.query(detail, { visitorId: first.id, sessionToken: "host-session" })).toMatchObject({ visitorPhone: null, notes: null });
    const page = await t.query(listPage, { sessionToken: "host-session", paginationOpts: { numItems: 20, cursor: null } });
    expect(page.page[0]).not.toHaveProperty("visitorPhone");
    expect(page.page[0]).not.toHaveProperty("notes");
  });

  it("preserves omitted values, persists explicit nullable clearing, and rejects cross-host notes writes", async () => {
    const { t } = await setup();
    const id = await created(t);
    const { requestId: _request, noticeReviewed: _reviewed, visitorPhone: _phone, ...fields } = input;
    await t.mutation(update, { ...fields, notes: "Synthetic note\nSecond line", visitorId: id, sessionToken: "host-session" });
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ visitorPhone: input.visitorPhone, notes: "Synthetic note\nSecond line" });
    await t.mutation(update, { ...fields, firstName: "Updated", visitorId: id, sessionToken: "host-session" });
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ visitorPhone: input.visitorPhone, notes: "Synthetic note\nSecond line" });
    const before = await t.run(ctx => ctx.db.get(id));
    await expect(t.mutation(update, { ...fields, visitorPhone: null, notes: "Foreign edit", visitorId: id, sessionToken: "other-session" })).rejects.toMatchObject({ data: { code: "ACCESS_DENIED" } });
    await expect(t.query(detail, { visitorId: id, sessionToken: "other-session" })).rejects.toMatchObject({ data: { code: "ACCESS_DENIED" } });
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    await expect(t.mutation(update, { ...fields, notes: "x".repeat(1001), visitorId: id, sessionToken: "host-session" })).rejects.toMatchObject({ data: { code: "VISITOR_INVALID" } });
    expect(await t.run(ctx => ctx.db.get(id))).toEqual(before);
    await t.mutation(update, { ...fields, visitorPhone: null, notes: null, visitorId: id, sessionToken: "host-session" });
    const cleared = await t.run(ctx => ctx.db.get(id));
    expect(cleared).not.toHaveProperty("visitorPhone");
    expect(cleared).not.toHaveProperty("notes");
    expect(await t.query(detail, { visitorId: id, sessionToken: "host-session" })).toMatchObject({ visitorPhone: null, notes: null });
  });
});
