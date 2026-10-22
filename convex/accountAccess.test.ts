// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";
import { getValidAuthUserId } from "./lib/auth";
import { activeSuperAdminCount } from "./lib/adminGuards";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
async function setup(role: Doc<"users">["role"] = "super_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const caller = await ctx.db.insert("users", { role, verified: true });
    const target = await ctx.db.insert("users", { role: "project_user", verified: true });
    const session = await ctx.db.insert("authSessions", { userId: caller, expirationTime: Date.now() + 1_000_000 });
    const targetSession = await ctx.db.insert("authSessions", { userId: target, expirationTime: Date.now() + 1_000_000 });
    const project = await ctx.db.insert("projects", { name: "Proje", ownerId: caller });
    await ctx.db.insert("userProjects", { userId: caller, projectId: project });
    await ctx.db.insert("userProjects", { userId: target, projectId: project });
    return { caller, target, session, targetSession, project };
  });
  const caller = t.withIdentity({ subject: `${ids.caller}|${ids.session}` });
  const target = t.withIdentity({ subject: `${ids.target}|${ids.targetSession}` });
  return { t, ids, caller, target };
}

describe("account access guards", () => {
  it.each(["disabled", "expired", "unverified"] as const)("rejects all full guards for %s accounts", async block => {
    const { t, ids, target } = await setup();
    await t.run(ctx => ctx.db.patch(ids.target, block === "disabled" ? { disabledAt: Date.now() } : block === "expired" ? { accessExpiresAt: Date.now() - 1 } : { verified: false }));
    await expect(target.query(api.userProjects.getProjectIdsByUser, { userId: ids.target })).rejects.toThrow();
    await expect(target.mutation(api.users.updateProfile, { fullName: "Yeni" })).rejects.toThrow();
    await expect(target.mutation(api.accountAccess.freezeUser, { userId: ids.caller })).rejects.toThrow();
    await expect(target.action(api.deviceSyncRuns.startProjectResync, { projectId: ids.project })).rejects.toThrow();
    expect(await target.query(api.userProjects.getByCurrentUser, {})).toEqual([]);
  });
  it("returns null for expired sessions and blocked users, while legacy users work", async () => {
    const { t, ids, target } = await setup();
    expect(await target.run(ctx => getValidAuthUserId(ctx))).toBe(ids.target);
    await t.run(ctx => ctx.db.patch(ids.targetSession, { expirationTime: Date.now() - 1 }));
    expect(await target.run(ctx => getValidAuthUserId(ctx))).toBeNull();
    expect(await target.query(api.users.currentUser, {})).toBeNull();
  });
});

describe("account access management", () => {
  it.each(["super_admin", "project_admin"] as const)("%s freezes scoped users, deletes sessions/tokens, and unfreezes", async role => {
    const { t, ids, caller } = await setup(role);
    const token = await t.run(ctx => ctx.db.insert("authRefreshTokens", { sessionId: ids.targetSession, expirationTime: Date.now() + 1_000_000 }));
    await caller.mutation(api.accountAccess.freezeUser, { userId: ids.target });
    await t.run(async ctx => {
      expect(await ctx.db.get(ids.targetSession)).toBeNull();
      expect(await ctx.db.get(token)).toBeNull();
      expect(await ctx.db.get(ids.target)).toMatchObject({ disabledBy: ids.caller });
      const logs = await ctx.db.query("auditLog").take(5);
      expect(logs[0].note).toBe("user.frozen");
      expect(logs[0].userName).toBeUndefined();
      expect(logs[0].userId).toBe(ids.caller);
    });
    await caller.mutation(api.accountAccess.unfreezeUser, { userId: ids.target });
    await t.run(async ctx => { expect((await ctx.db.get(ids.target))?.disabledAt).toBeUndefined(); });
  });
  it("rejects project users and self operations", async () => {
    const { caller, ids } = await setup("project_user");
    await expect(caller.mutation(api.accountAccess.freezeUser, { userId: ids.target })).rejects.toThrow("yetkiniz yok");
    const admin = await setup();
    for (const name of ["freezeUser", "unfreezeUser"] as const) await expect(admin.caller.mutation(api.accountAccess[name], { userId: admin.ids.caller })).rejects.toThrow("Kendi hesabınız");
    await expect(admin.caller.mutation(api.accountAccess.setAccessExpiry, { userId: admin.ids.caller, accessExpiresAt: null })).rejects.toThrow("Kendi hesabınız");
  });
  it("rejects mixed project membership and non-project-user targets", async () => {
    const { t, caller, ids } = await setup("project_admin");
    await t.run(async ctx => {
      const other = await ctx.db.insert("projects", { name: "Başka" });
      await ctx.db.insert("userProjects", { userId: ids.target, projectId: other });
    });
    await expect(caller.mutation(api.accountAccess.freezeUser, { userId: ids.target })).rejects.toThrow("başka projelerde");
    await t.run(ctx => ctx.db.patch(ids.target, { role: "project_admin" }));
    await expect(caller.mutation(api.accountAccess.freezeUser, { userId: ids.target })).rejects.toThrow("yetkiniz yok");
  });
  it("counts effective admins rather than frozen or expired admins", async () => {
    const { t, ids } = await setup();
    await t.run(async ctx => {
      await ctx.db.insert("users", { role: "super_admin", disabledAt: Date.now() });
      await ctx.db.insert("users", { role: "super_admin", accessExpiresAt: Date.now() - 1 });
      expect(await activeSuperAdminCount(ctx)).toBe(1);
      await ctx.db.patch(ids.target, { role: "super_admin" });
      expect(await activeSuperAdminCount(ctx)).toBe(2);
    });
  });
  it("protects last effective admin for freeze, expiry, role and deletion", async () => {
    const { caller, ids, t } = await setup();
    await t.run(ctx => ctx.db.insert("users", { role: "super_admin", disabledAt: Date.now() }));
    await expect(caller.mutation(api.accountAccess.freezeUser, { userId: ids.caller })).rejects.toThrow();
    await expect(caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.caller, accessExpiresAt: Date.now() + 120_000 })).rejects.toThrow();
    await expect(caller.mutation(api.users.updateRole, { userId: ids.caller, role: "project_user" })).rejects.toThrow("son süper admin");
    await expect(caller.mutation(api.users.deleteUser, { userId: ids.caller })).rejects.toThrow("son süper admin");
  });
  it("super admin can manage other roles and counts beyond inactive first rows", async () => {
    const { t, caller, ids } = await setup();
    await t.run(async ctx => {
      await ctx.db.insert("users", { role: "super_admin", disabledAt: 1 });
      await ctx.db.patch(ids.target, { role: "super_admin" });
    });
    await caller.mutation(api.accountAccess.freezeUser, { userId: ids.target });
    await caller.mutation(api.accountAccess.unfreezeUser, { userId: ids.target });
  });
  it("continues beyond 50 sessions and 100 refresh tokens", async () => {
    vi.useFakeTimers();
    const { t, caller, ids } = await setup();
    await t.run(async ctx => {
      for (let i = 0; i < 51; i++) await ctx.db.insert("authSessions", { userId: ids.target, expirationTime: Date.now() + 1_000_000 });
      for (let i = 0; i < 101; i++) await ctx.db.insert("authRefreshTokens", { sessionId: ids.targetSession, expirationTime: Date.now() + 1_000_000 });
    });
    await caller.mutation(api.accountAccess.freezeUser, { userId: ids.target });
    await t.run(async ctx => { expect((await ctx.db.system.query("_scheduled_functions").take(10)).length).toBeGreaterThan(0); });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.run(async ctx => {
      expect(await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", ids.target)).take(100)).toHaveLength(0);
      expect(await ctx.db.query("authRefreshTokens").take(200)).toHaveLength(0);
    });
  });
});

describe("access expiry", () => {
  it("rejects past, less than one minute, and nonfinite values", async () => {
    const { caller, ids } = await setup();
    for (const accessExpiresAt of [Date.now() - 1, Date.now() + 30_000, Infinity, NaN]) await expect(caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt })).rejects.toThrow();
  });
  it("schedules runAt, cancels previous jobs, and clears fields", async () => {
    const { t, caller, ids } = await setup();
    await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: Date.now() + 120_000 });
    const job = await t.run(async ctx => (await ctx.db.get(ids.target))?.accessExpiryJobId);
    expect(job).toBeDefined();
    await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: Date.now() + 180_000 });
    await t.run(async ctx => {
      if (!job) throw new Error("job missing");
      expect((await ctx.db.system.get(job))?.state.kind).toBe("canceled");
    });
    await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: null });
    await t.run(async ctx => {
      const user = await ctx.db.get(ids.target);
      expect(user?.accessExpiresAt).toBeUndefined();
      expect(user?.accessExpiryJobId).toBeUndefined();
    });
  });
  it("stale jobs do nothing, matching elapsed expiry revokes sessions", async () => {
    const { t, ids } = await setup();
    const expiry = Date.now() - 1;
    await t.run(ctx => ctx.db.patch(ids.target, { accessExpiresAt: expiry }));
    await t.mutation(internal.accountAccess.expireAccess, { userId: ids.target, expectedExpiresAt: expiry - 1 });
    await t.run(async ctx => { expect(await ctx.db.get(ids.targetSession)).not.toBeNull(); });
    await t.mutation(internal.accountAccess.expireAccess, { userId: ids.target, expectedExpiresAt: expiry });
    await t.run(async ctx => {
      expect(await ctx.db.get(ids.targetSession)).toBeNull();
      expect((await ctx.db.query("auditLog").take(5))[0].note).toBe("user.access_expired");
    });
  });
});

describe("Convex Auth beforeSessionCreation and seven-day sessions", () => {
  it.each(["disabled", "expired"] as const)("rejects %s users at actual session creation", async reason => {
    const { t, ids } = await setup();
    await t.run(ctx => ctx.db.patch(ids.target, reason === "disabled" ? { disabledAt: Date.now() } : { accessExpiresAt: Date.now() - 1 }));
    await expect(t.mutation(internal.auth.store, { args: { type: "signIn", userId: ids.target, generateTokens: false } })).rejects.toThrow("Giriş yapılamadı");
  });
  it.each([true, false, undefined])("allows normal and new signUp profiles (verified=%s) and creates seven-day sessions", async verified => {
    const { t, ids } = await setup();
    await t.run(ctx => ctx.db.patch(ids.target, { verified }));
    const now = Date.now();
    await t.mutation(internal.auth.store, { args: { type: "signIn", userId: ids.target, generateTokens: false } });
    const sessions = await t.run(ctx => ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", ids.target)).take(10));
    const newest = sessions[sessions.length - 1];
    expect(newest?.expirationTime).toBeGreaterThanOrEqual(now + 7 * 86400000);
    expect(newest?.expirationTime).toBeLessThan(now + 7 * 86400000 + 5000);
    expect(sessions[0].expirationTime).toBeLessThan(now + 7 * 86400000);
  });
  it("unfreeze permits a new session without reviving old sessions", async () => {
    const { t, caller, ids } = await setup();
    await caller.mutation(api.accountAccess.freezeUser, { userId: ids.target });
    await caller.mutation(api.accountAccess.unfreezeUser, { userId: ids.target });
    await t.mutation(internal.auth.store, { args: { type: "signIn", userId: ids.target, generateTokens: false } });
    await t.run(async ctx => {
      expect(await ctx.db.get(ids.targetSession)).toBeNull();
      expect(await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", ids.target)).take(10)).toHaveLength(1);
    });
  });
});

it("does not restore old sessions while deferred freeze cleanup is pending", async () => {
  vi.useFakeTimers();
  const { t, ids, caller } = await setup();
  await t.run(async ctx => {
    for (let i = 0; i < 51; i++) await ctx.db.insert("authSessions", { userId: ids.target, expirationTime: Date.now() + 1000000 });
  });
  await caller.mutation(api.accountAccess.freezeUser, { userId: ids.target });
  await expect(caller.mutation(api.accountAccess.unfreezeUser, { userId: ids.target })).rejects.toThrow("Oturumlar kapatılıyor");
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await caller.mutation(api.accountAccess.unfreezeUser, { userId: ids.target });
});

it("scheduled expiry invalidates sessions and the optional profile through the orphan path", async () => {
  vi.useFakeTimers();
  const { t, ids, caller, target } = await setup();
  await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: Date.now() + 120000 });
  expect(await target.query(api.users.currentUser, {})).not.toBeNull();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await target.query(api.users.currentUser, {})).toBeNull();
  await t.run(async ctx => {
    expect(await ctx.db.get(ids.targetSession)).toBeNull();
    const row = await ctx.db.get(ids.target);
    expect(row?.accessExpiryJobId).toBeUndefined();
  });
});

it.each([null, 180_000])("recovers elapsed expiry with deferred sessions (new expiry %s)", async delay => {
  vi.useFakeTimers();
  const { t, caller, ids } = await setup();
  const sessions = await t.run(async ctx => {
    await ctx.db.patch(ids.target, { accessExpiresAt: Date.now() - 1 });
    const result = [];
    for (let i = 0; i < 52; i++) {
      result.push(await ctx.db.insert("authSessions", { userId: ids.target, expirationTime: Date.now() + 1_000_000 }));
    }
    return result;
  });
  const accessExpiresAt = delay === null ? null : Date.now() + delay;
  await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt });
  const remaining = sessions[sessions.length - 1];
  await t.run(async ctx => {
    expect(await ctx.db.get(remaining)).not.toBeNull();
    expect((await ctx.db.get(ids.target))?.accessExpiresAt).toBe(accessExpiresAt ?? undefined);
  });
  const stale = t.withIdentity({ subject: `${ids.target}|${remaining}` });
  expect(await stale.query(api.users.currentUser, {})).toBeNull();
  await t.mutation(internal.auth.store, { args: { type: "signIn", userId: ids.target, generateTokens: false } });
  const newest = await t.run(ctx => ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", ids.target)).order("desc").first());
  if (!newest) throw new Error("Missing new session");
  const fresh = t.withIdentity({ subject: `${ids.target}|${newest._id}` });
  expect(await fresh.query(api.users.currentUser, {})).not.toBeNull();
  // Run only immediate cleanup, leaving a newly assigned future expiry pending.
  await t.finishInProgressScheduledFunctions();
  await vi.advanceTimersByTimeAsync(1);
  await t.finishInProgressScheduledFunctions();
  expect(await stale.query(api.users.currentUser, {})).toBeNull();
  expect(await fresh.query(api.users.currentUser, {})).not.toBeNull();
});

it("project memberships return no data for absent/expired sessions and valid memberships for verified users", async () => {
  const { t, ids, target } = await setup();
  expect(await t.query(api.userProjects.getByCurrentUser, {})).toEqual([]);
  expect(await target.query(api.userProjects.getByCurrentUser, {})).toMatchObject([{ projectId: ids.project }]);
  await t.run(ctx => ctx.db.patch(ids.targetSession, { expirationTime: Date.now() - 1 }));
  expect(await target.query(api.userProjects.getByCurrentUser, {})).toEqual([]);
});


describe("audit regressions", () => {
  it.each(["freezeUser", "unfreezeUser", "setAccessExpiry"] as const)("rejects unassigned targets for project admins: %s", async method => {
    const { t, caller, ids } = await setup("project_admin");
    await t.run(async ctx => {
      const rows = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", ids.target)).take(10);
      for (const row of rows) await ctx.db.delete(row._id);
    });
    const operation = method === "setAccessExpiry"
      ? caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: null })
      : caller.mutation(api.accountAccess[method], { userId: ids.target });
    await expect(operation).rejects.toThrow("yalnız sistem yöneticisi");
  });
  it.each([0, -60_000, 60_000])("rejects crossed future expiries (offset %s)", async offset => {
    const { t, caller, target, ids } = await setup();
    await t.run(ctx => ctx.db.patch(ids.target, { role: "super_admin" }));
    const expiry = Date.now() + 300_000;
    await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: expiry });
    await expect(target.mutation(api.accountAccess.setAccessExpiry, { userId: ids.caller, accessExpiresAt: expiry + offset })).rejects.toThrow("son etkin");
  });
  it("permits crossed expiries while a third permanent admin remains", async () => {
    const { t, caller, target, ids } = await setup();
    await t.run(async ctx => {
      await ctx.db.patch(ids.target, { role: "super_admin" });
      await ctx.db.insert("users", { role: "super_admin", verified: true });
    });
    await caller.mutation(api.accountAccess.setAccessExpiry, { userId: ids.target, accessExpiresAt: Date.now() + 300_000 });
    await target.mutation(api.accountAccess.setAccessExpiry, { userId: ids.caller, accessExpiresAt: Date.now() + 180_000 });
  });
  it.each(["freeze", "role", "delete"] as const)("an expiring admin cannot remove the permanent admin: %s", async method => {
    const { t, caller, ids } = await setup();
    await t.run(async ctx => {
      await ctx.db.patch(ids.target, { role: "super_admin" });
      await ctx.db.patch(ids.caller, { accessExpiresAt: Date.now() + 300_000 });
    });
    const operation = method === "freeze" ? caller.mutation(api.accountAccess.freezeUser, { userId: ids.target })
      : method === "role" ? caller.mutation(api.users.updateRole, { userId: ids.target, role: "project_user" })
      : caller.mutation(api.users.deleteUser, { userId: ids.target });
    await expect(operation).rejects.toThrow(/son.*admin/);
  });
  it.each(["expiry", "freeze", "role", "delete"] as const)("keeps an admin across concurrent crossed %s requests", async method => {
    const { t, caller, target, ids } = await setup();
    await t.run(ctx => ctx.db.patch(ids.target, { role: "super_admin" }));
    const expiry = Date.now() + 300_000;
    const operation = (actor: typeof caller, userId: typeof ids.target) => method === "expiry"
      ? actor.mutation(api.accountAccess.setAccessExpiry, { userId, accessExpiresAt: expiry })
      : method === "freeze" ? actor.mutation(api.accountAccess.freezeUser, { userId })
      : method === "role" ? actor.mutation(api.users.updateRole, { userId, role: "project_user" })
      : actor.mutation(api.users.deleteUser, { userId });
    const results = await Promise.allSettled([operation(caller, ids.target), operation(target, ids.caller)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    await t.run(async ctx => {
      const admins = await ctx.db.query("users").withIndex("by_role", q => q.eq("role", "super_admin")).take(10);
      expect(admins.filter(user => user.disabledAt === undefined && user.accessExpiresAt === undefined)).toHaveLength(1);
    });
  });
});
