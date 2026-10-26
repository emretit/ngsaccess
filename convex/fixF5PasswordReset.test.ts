// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { Scrypt } from "lucia";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

vi.mock("./lib/rateLimit", () => ({ limiter: { limit: vi.fn(async () => undefined) } }));
const modules = import.meta.glob("./**/*.ts");
const email = "recipient@example.test";
const oldPassword = "Oldpassword1";
const password = "Newpassword2";
let oldHash: string;
beforeAll(async () => { oldHash = await new Scrypt().hash(oldPassword); });

async function setup(options: {
  type?: "invite" | "reset";
  used?: boolean;
  expiresAt?: string;
  target?: Partial<Doc<"users">>;
  member?: boolean;
  callerRole?: Doc<"users">["role"];
  callerMember?: boolean;
  account?: boolean;
  accountEmail?: string;
} = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const caller = await ctx.db.insert("users", { role: options.callerRole ?? "project_admin", verified: true });
    const user = await ctx.db.insert("users", { email, verified: true, role: "project_user", name: "Korunan İsim", ...options.target });
    const project = await ctx.db.insert("projects", { name: "Proje", ownerId: caller });
    if (options.callerMember !== false) await ctx.db.insert("userProjects", { userId: caller, projectId: project, role: "admin" });
    if (options.member !== false) {
      await ctx.db.insert("userProjects", { userId: user, projectId: project, role: "viewer" });
    } else {
      const otherProject = await ctx.db.insert("projects", { name: "Başka proje" });
      await ctx.db.insert("userProjects", { userId: user, projectId: otherProject, role: "viewer" });
    }
    const account = options.account === false ? null : await ctx.db.insert("authAccounts", {
      userId: user, provider: "password", providerAccountId: options.accountEmail ?? email, secret: oldHash,
    });
    const session = await ctx.db.insert("authSessions", { userId: user, expirationTime: Date.now() + 100_000 });
    const secondSession = await ctx.db.insert("authSessions", { userId: user, expirationTime: Date.now() + 100_000 });
    const callerSession = await ctx.db.insert("authSessions", { userId: caller, expirationTime: Date.now() + 100_000 });
    const refresh = await ctx.db.insert("authRefreshTokens", { sessionId: session, expirationTime: Date.now() + 100_000 });
    const secondRefresh = await ctx.db.insert("authRefreshTokens", { sessionId: secondSession, expirationTime: Date.now() + 100_000 });
    const childRefresh = await ctx.db.insert("authRefreshTokens", { sessionId: session, parentRefreshTokenId: refresh, expirationTime: Date.now() + 100_000 });
    const invite = await ctx.db.insert("invites", {
      email, token: "reset-token", projectId: project, role: "admin", createdBy: caller,
      type: options.type ?? "reset", used: options.used ?? false,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 100_000).toISOString(), createdAt: new Date().toISOString(),
    });
    return { caller, user, project, account, session, secondSession, callerSession, refresh, secondRefresh, childRefresh, invite };
  });
  const recipient = t.withIdentity({ subject: `${ids.user}|${ids.session}` });
  return { t, ids, recipient };
}
const input = { token: "reset-token", email, password };

async function expectUnchanged(f: Awaited<ReturnType<typeof setup>>, used = false) {
  await f.t.run(async ctx => {
    if (f.ids.account) expect((await ctx.db.get(f.ids.account))?.secret).toBe(oldHash);
    expect((await ctx.db.get(f.ids.invite))?.used).toBe(used);
    for (const id of [f.ids.session, f.ids.secondSession, f.ids.refresh, f.ids.secondRefresh, f.ids.childRefresh]) {
      expect(await ctx.db.get(id)).not.toBeNull();
    }
    expect(await ctx.db.query("auditLog").collect()).toHaveLength(0);
  });
}

describe("F5-A password reset invitation", () => {
  it("changes the actual Auth hash, revokes every old session/refresh token and consumes the invitation once", async () => {
    const f = await setup();
    expect(await f.recipient.query(api.users.currentUser, {})).toMatchObject({ _id: f.ids.user });
    await f.t.mutation(api.invites.consume, input);
    await f.t.run(async ctx => {
      const account = f.ids.account ? await ctx.db.get(f.ids.account) : null;
      expect(account?.secret).not.toBe(oldHash);
      expect(account?.secret).not.toBe(password);
      expect((await ctx.db.get(f.ids.invite))?.used).toBe(true);
      for (const id of [f.ids.session, f.ids.secondSession, f.ids.refresh, f.ids.secondRefresh, f.ids.childRefresh]) {
        expect(await ctx.db.get(id)).toBeNull();
      }
      expect(await ctx.db.get(f.ids.callerSession)).not.toBeNull();
      expect(await ctx.db.get(f.ids.user)).toMatchObject({ name: "Korunan İsim", role: "project_user", verified: true });
      expect(await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", f.ids.user)).collect())
        .toMatchObject([{ projectId: f.ids.project, role: "viewer" }]);
      const audit = await ctx.db.query("auditLog").unique();
      expect(audit).toMatchObject({ targetId: f.ids.user, action: "update", newValue: { passwordReset: true, inviteId: f.ids.invite } });
      expect(JSON.stringify(audit)).not.toContain(email);
      expect(JSON.stringify(audit)).not.toContain(password);
      expect(JSON.stringify(audit)).not.toContain(oldHash);
    });
    expect(await f.recipient.query(api.users.currentUser, {})).toBeNull();
    await expect(f.recipient.mutation(api.users.updateProfile, { fullName: "Eski JWT" })).rejects.toThrow();
    expect(await f.t.query(api.invites.verify, { token: input.token })).toBeNull();
    await expect(f.t.mutation(api.invites.consume, { ...input, password: "Anotherpass3" })).rejects.toThrow("INVITE_INVALID");
    // Real Password provider credential verification: new password accepted; old one rejected.
    expect(await f.t.mutation(internal.auth.store, { args: {
      type: "retrieveAccountWithCredentials", provider: "password", account: { id: email, secret: password },
    } })).toMatchObject({ user: { _id: f.ids.user } });
    expect(await f.t.mutation(internal.auth.store, { args: {
      type: "retrieveAccountWithCredentials", provider: "password", account: { id: email, secret: oldPassword },
    } })).toBe("InvalidSecret");
    // Simulate the session issued after successful authentication; the shared guard accepts it.
    const newSession = await f.t.run(ctx => ctx.db.insert("authSessions", { userId: f.ids.user, expirationTime: Date.now() + 100_000 }));
    expect(await f.t.withIdentity({ subject: `${f.ids.user}|${newSession}` }).query(api.users.currentUser, {}))
      .toMatchObject({ _id: f.ids.user });
  });

  it.each([
    { expiresAt: new Date(0).toISOString() },
    { expiresAt: "invalid-date" },
    { used: true },
  ])("rejects expired, malformed or consumed invites without writes: %j", async options => {
    const f = await setup(options);
    await expect(f.t.mutation(api.invites.consume, input)).rejects.toThrow("INVITE_INVALID");
    await expectUnchanged(f, options.used ?? false);
    expect(await f.t.query(api.invites.verify, { token: input.token })).toBeNull();
  });

  it("rejects a different email without changing either user's credentials", async () => {
    const f = await setup();
    const other = await f.t.run(async ctx => {
      const user = await ctx.db.insert("users", { email: "other@example.test", role: "project_user", verified: true });
      return await ctx.db.insert("authAccounts", { userId: user, provider: "password", providerAccountId: "other@example.test", secret: oldHash });
    });
    await expect(f.t.mutation(api.invites.consume, { ...input, email: "other@example.test" })).rejects.toThrow("INVITE_EMAIL_MISMATCH");
    expect((await f.t.run(ctx => ctx.db.get(other)))?.secret).toBe(oldHash);
    await expectUnchanged(f);
  });

  it.each(["weak", "abcdefgh1", "ABCDEFGH1", "Abcdefgh", ""])("rejects weak password %j with no writes", async weak => {
    const f = await setup();
    await expect(f.t.mutation(api.invites.consume, { ...input, password: weak })).rejects.toThrow("INVITE_WEAK_PASSWORD");
    await expectUnchanged(f);
  });

  it("requires a new password and does not let the old consume contract close a reset invite", async () => {
    const f = await setup();
    await expect(f.recipient.mutation(api.invites.consume, { token: input.token, email })).rejects.toThrow("INVITE_WEAK_PASSWORD");
    await expectUnchanged(f);
  });

  it.each([
    { account: false },
    { accountEmail: "different@example.test" },
    { target: { email: "different@example.test" } },
    { target: { verified: false } },
    { target: { role: "super_admin" as const } },
  ])("does not create accounts or reset a protected/mismatched account: %j", async options => {
    const f = await setup(options);
    await expect(f.t.mutation(api.invites.consume, input)).rejects.toThrow("INVITE_ACCOUNT_EXISTS");
    await expectUnchanged(f);
  });

  it("rejects a target that no longer belongs to the invitation project", async () => {
    const f = await setup({ member: false });
    await expect(f.t.mutation(api.invites.consume, input)).rejects.toThrow("INVITE_EMAIL_MISMATCH");
    await expectUnchanged(f);
  });

  it("rejects a reset after the creator loses project permission", async () => {
    const f = await setup({ callerMember: false });
    await expect(f.t.mutation(api.invites.consume, input)).rejects.toThrow("INVITE_INVALID");
    await expectUnchanged(f);
  });

  it.each([{ disabledAt: 1 }, { accessExpiresAt: 1 }, { verified: false }])("rejects reset links from a creator whose account is no longer active: %j", async change => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.ids.caller, change));
    await expect(f.t.mutation(api.invites.consume, input)).rejects.toThrow("INVITE_INVALID");
    await expectUnchanged(f);
  });

  it("accepts only one concurrent use of a reset link", async () => {
    const f = await setup();
    const results = await Promise.allSettled([
      f.t.mutation(api.invites.consume, input),
      f.t.mutation(api.invites.consume, { ...input, password: "Anotherpass3" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(1);
  });

  it("a normal invite cannot overwrite an existing password or revoke sessions", async () => {
    const f = await setup({ type: "invite" });
    await expect(f.t.action(api.invites.claimSetupAccount, { token: input.token, password })).rejects.toThrow("INVITE_ACCOUNT_EXISTS");
    await expectUnchanged(f);
    await f.recipient.mutation(api.invites.consume, input);
    await f.t.run(async ctx => {
      expect(f.ids.account ? (await ctx.db.get(f.ids.account))?.secret : null).toBe(oldHash);
      expect(await ctx.db.get(f.ids.session)).not.toBeNull();
      expect((await ctx.db.get(f.ids.invite))?.used).toBe(true);
    });
  });

  it("rolls back the password update and session deletion if the final audit write fails", async () => {
    const f = await setup();
    // Inject failure only at the final audit insert, after nested Auth writes have run.
    const { consume } = await import("./invites");
    const handler = (consume as unknown as { _handler: (ctx: import("./_generated/server").MutationCtx, args: typeof input) => Promise<null> })._handler;
    await expect(f.t.run(async ctx => {
      const insert = ctx.db.insert.bind(ctx.db);
      ctx.db.insert = async (...args) => {
        if (args[0] === "auditLog") throw new Error("Audit failure");
        return insert(...args);
      };
      await handler(ctx, input);
    })).rejects.toThrow("Audit failure");
    await expectUnchanged(f);
  });
});

describe("F5-A reset creation scope", () => {
  it.each(["project_admin", "super_admin"] as const)("allows authorized %s to reset an existing project user", async callerRole => {
    const f = await setup({ callerRole });
    const token = await f.t.mutation(internal.invites.create, { callerId: f.ids.caller, email: email.toUpperCase(), projectId: f.ids.project, role: "viewer", type: "reset" });
    expect(await f.t.query(api.invites.verify, { token })).toMatchObject({ email, type: "reset" });
    expect((await f.t.run(ctx => ctx.db.get(f.ids.invite)))?.used).toBe(true);
  });
  it.each([
    { account: false },
    { target: { role: "super_admin" as const } },
    { member: false },
  ])("returns the same public code and message without revealing account existence: %j", async options => {
    const f = await setup(options);
    await expect(f.t.mutation(internal.invites.create, {
      callerId: f.ids.caller, email, projectId: f.ids.project, role: "viewer", type: "reset",
    })).rejects.toMatchObject({ data: {
      code: "INVITE_RESET_UNAVAILABLE",
      message: "Bu kullanıcıya şifre sıfırlama bağlantısı gönderilemiyor.",
    } });
    await expectUnchanged(f);
    expect(await f.t.run(ctx => ctx.db.query("invites").collect())).toHaveLength(1);
  });
  it.each([
    { member: false },
    { target: { role: "super_admin" as const } },
    { callerRole: "super_admin" as const, target: { role: "super_admin" as const } },
    { account: false },
    { callerRole: "project_user" as const, callerMember: false },
    { callerMember: false },
  ])("rejects an out-of-scope/protected reset target or unauthorized caller: %j", async options => {
    const f = await setup(options);
    await expect(f.t.mutation(internal.invites.create, { callerId: f.ids.caller, email, projectId: f.ids.project, role: "viewer", type: "reset" })).rejects.toThrow();
    await expectUnchanged(f);
    expect(await f.t.run(ctx => ctx.db.query("invites").collect())).toHaveLength(1);
  });
});


describe("F5-A reset action eligibility", () => {
  it.each([
    { options: {}, allowed: true },
    { options: { account: false }, allowed: false },
    { options: { target: { role: "super_admin" as const } }, allowed: false },
    { options: { target: { disabledAt: 0 } }, allowed: false },
    { options: { target: { accessExpiresAt: 0 } }, allowed: false },
    { options: { target: { verified: false } }, allowed: false },
    { options: { accountEmail: "someone-else@example.test" }, allowed: false },
  ])("exposes only reset eligibility in authorized user lists: %j", async ({ options, allowed }) => {
    const f = await setup(options);
    const caller = f.t.withIdentity({ subject: `${f.ids.caller}|${f.ids.callerSession}` });
    const members = await caller.query(api.roles.listProjectMembers, { projectId: f.ids.project });
    expect(members.find(row => row.userId === f.ids.user)?.canResetPassword).toBe(allowed);
    const users = await caller.query(api.users.adminList, { paginationOpts: { cursor: null, numItems: 10 } });
    expect(users.page.find(row => row._id === f.ids.user)?.canResetPassword).toBe(allowed);
    expect(JSON.stringify({ members, users })).not.toContain(oldHash);
  });
  it("does not expose a different project's reset target", async () => {
    const f = await setup({ member: false });
    const caller = f.t.withIdentity({ subject: `${f.ids.caller}|${f.ids.callerSession}` });
    const users = await caller.query(api.users.adminList, { paginationOpts: { cursor: null, numItems: 10 } });
    expect(users.page.some(row => row._id === f.ids.user)).toBe(false);
    const otherProject = await f.t.run(ctx => ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", f.ids.user)).unique());
    if (!otherProject) throw new Error("Missing target membership");
    await expect(caller.query(api.roles.listProjectMembers, { projectId: otherProject.projectId })).rejects.toThrow();
  });
});
