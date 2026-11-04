// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

vi.mock("./lib/rateLimit", () => ({ limiter: { limit: vi.fn(async () => undefined) } }));
const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const creator = await ctx.db.insert("users", { verified: true, role: "project_user" });
    const recipient = await ctx.db.insert("users", { email: "recipient@example.test", verified: false });
    const session = await ctx.db.insert("authSessions", { userId: recipient, expirationTime: Date.now() + 3600000 });
    const admin = await ctx.db.insert("users", { verified: true, role: "super_admin" });
    const adminSession = await ctx.db.insert("authSessions", { userId: admin, expirationTime: Date.now() + 3600000 });
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const membership = await ctx.db.insert("userProjects", { userId: creator, projectId, role: "admin" });
    const invite = await ctx.db.insert("invites", { email: "recipient@example.test", token: "token", createdBy: creator, projectId, role: "admin", used: false, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() });
    return { creator, recipient, session, admin, adminSession, projectId, otherProjectId, membership, invite };
  });
  return { t, ...ids, recipientClient: t.withIdentity({ subject: `${ids.recipient}|${ids.session}` }), adminClient: t.withIdentity({ subject: `${ids.admin}|${ids.adminSession}` }) };
}

describe("HSP-01 invite authority at acceptance", () => {
  it.each(["frozen", "membershipRemoved", "demoted", "unverified", "expired", "deleted"] as const)("rejects creator %s without verifying recipient or granting membership", async reason => {
    const f = await setup();
    if (reason === "frozen") await f.adminClient.mutation(api.accountAccess.freezeUser, { userId: f.creator });
    else if (reason === "membershipRemoved") {
      await f.t.run(ctx => ctx.db.insert("userProjects", { userId: f.recipient, projectId: f.projectId, role: "admin" }));
      await f.t.run(ctx => ctx.db.patch(f.recipient, { verified: true }));
      await f.adminClient.mutation(api.users.updateRole, { userId: f.creator, role: "project_user", projectIds: [] });
      await f.t.run(async ctx => {
        const rows = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", f.recipient)).take(10);
        for (const row of rows) await ctx.db.delete(row._id);
        await ctx.db.patch(f.recipient, { verified: false });
      });
    } else await f.t.run(async ctx => {
      if (reason === "demoted") await ctx.db.patch(f.membership, { role: "viewer" });
      if (reason === "unverified") await ctx.db.patch(f.creator, { verified: false });
      if (reason === "expired") await ctx.db.patch(f.creator, { accessExpiresAt: Date.now() - 1 });
      if (reason === "deleted") await ctx.db.delete(f.creator);
    });
    await expect(f.recipientClient.mutation(api.invites.consume, { token: "token", email: "recipient@example.test" })).rejects.toThrow("INVITE_INVALID");
    await f.t.run(async ctx => {
      expect((await ctx.db.get(f.recipient))?.verified).toBe(false);
      expect(await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", f.recipient)).take(10)).toEqual([]);
      expect((await ctx.db.get(f.invite))?.used).toBe(false);
    });
  });
  it("accepts a current project administrator's legacy invite", async () => {
    const f = await setup();
    await f.recipientClient.mutation(api.invites.consume, { token: "token", email: "recipient@example.test" });
    expect(await f.t.run(ctx => ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", f.recipient)).first())).toMatchObject({ projectId: f.projectId, role: "admin" });
  });
});

describe("HSP-02 project and purpose isolation", () => {
  it.each(["invite", "reset"] as const)("replacing %s preserves another project's links and the other purpose", async type => {
    const f = await setup();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.recipient, { verified: true });
      await ctx.db.insert("authAccounts", { userId: f.recipient, provider: "password", providerAccountId: "recipient@example.test" });
      await ctx.db.insert("userProjects", { userId: f.recipient, projectId: f.projectId, role: "viewer" });
    });
    const cases = await f.t.run(async ctx => {
      const rows = [];
      for (const projectId of [f.projectId, f.otherProjectId]) for (const purpose of [undefined, "invite", "reset"] as const) {
        const id = await ctx.db.insert("invites", { email: "recipient@example.test", token: `${projectId}-${purpose}`, projectId, role: "viewer", createdBy: f.creator, type: purpose, used: false, createdAt: "now", expiresAt: new Date(Date.now() + 3600000).toISOString() });
        rows.push({ id, shouldCancel: projectId === f.projectId && (purpose ?? "invite") === type });
      }
      return rows;
    });
    await f.t.mutation(internal.invites.create, { callerId: f.creator, email: "recipient@example.test", projectId: f.projectId, role: "viewer", type });
    for (const row of cases) expect((await f.t.run(ctx => ctx.db.get(row.id)))?.used).toBe(row.shouldCancel);
  });
});

it("HSP-04 expired listing retains reset purpose and defaults legacy invitations", async () => {
  const f = await setup();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.invite, { expiresAt: new Date(0).toISOString() });
    await ctx.db.insert("invites", { email: "reset@example.test", token: "reset", projectId: f.projectId, role: "viewer", createdBy: f.creator, type: "reset", used: false, createdAt: "now", expiresAt: new Date(0).toISOString() });
  });
  const rows = await f.adminClient.query(api.invites.listExpired, {});
  expect(rows.find(row => row.email === "reset@example.test")).toHaveProperty("type", "reset");
  expect(rows.find(row => row._id === f.invite)).toHaveProperty("type", "invite");
});

describe("Y-10 setup invitation authority", () => {
  it.each(["setup", "reset", "claim"] as const)("rejects revoked creator in %s before account changes", async path => {
    const f = await setup();
    await f.t.run(async ctx => {
      await ctx.db.insert("authAccounts", { userId: f.recipient, provider: "password", providerAccountId: "recipient@example.test" });
      await ctx.db.patch(f.membership, { role: "viewer" });
      await ctx.db.patch(f.recipient, { name: "Preserve me" });
    });
    const call = path === "setup" ? f.t.query(internal.invites.setupAccountState, { token: "token" })
      : path === "reset" ? f.t.mutation(internal.invites.resetClaimedAccount, { userId: f.recipient, token: "token" })
      : f.t.action(api.invites.claimSetupAccount, { token: "token", password: "Strongpass1" });
    await expect(call).rejects.toThrow("INVITE_INVALID");
    expect(await f.t.run(ctx => ctx.db.get(f.recipient))).toMatchObject({ name: "Preserve me", verified: false });
  });
});
