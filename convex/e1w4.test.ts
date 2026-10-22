// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());

async function fixture(role: "project_admin" | "project_user" | "super_admin" = "project_admin", membership = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Accessible" });
    const foreignId = await ctx.db.insert("projects", { name: "Foreign" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    if (membership) await ctx.db.insert("userProjects", { userId, projectId });
    return { projectId, foreignId, userId, sessionId };
  });
  return { t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), ...ids };
}

const creators = [
  { name: "generic", ref: api.devices.create, args: { name: "Synthetic" } },
  { name: "IDE", ref: api.devices.createIdePanel, args: { name: "Synthetic", ideDoorCount: 1 } },
  { name: "Hikvision", ref: api.devices.createHikDevice, args: { name: "Synthetic", doorCount: 1, readersPerDoor: 1 } },
] as const;

describe("device creation project boundary", () => {
  for (const creator of creators) {
    for (const role of ["project_admin", "project_user"] as const) {
      it(`${creator.name}: ${role} enforces manager role and project membership`, async () => {
        const { t, caller, projectId, foreignId } = await fixture(role);
        if (role === "project_user") {
          await expect(caller.mutation(creator.ref, creator.args)).rejects.toThrow("bir proje seçmelisiniz");
          await expect(caller.mutation(creator.ref, { ...creator.args, projectId: foreignId })).rejects.toThrow("yetkiniz yok");
          await expect(caller.mutation(creator.ref, { ...creator.args, projectId })).rejects.toThrow("yetkiniz yok");
          expect(await t.run(ctx => ctx.db.query("devices").collect())).toHaveLength(0);
          expect(await t.run(ctx => ctx.db.query("zones").collect())).toHaveLength(0);
          return;
        }
        await expect(caller.mutation(creator.ref, creator.args)).rejects.toThrow("bir proje seçmelisiniz");
        await expect(caller.mutation(creator.ref, { ...creator.args, projectId: foreignId })).rejects.toThrow("Bu işlem için yetkiniz yok");
        expect(await t.run(ctx => ctx.db.query("devices").collect())).toHaveLength(0);
        expect(await t.run(ctx => ctx.db.query("zones").collect())).toHaveLength(0);
        await caller.mutation(creator.ref, { ...creator.args, projectId });
        expect(await t.run(ctx => ctx.db.query("devices").collect())).toMatchObject([{ projectId }]);
      });
    }
    it(`${creator.name}: rejects a caller without memberships`, async () => {
      const { caller, projectId } = await fixture("project_admin", false);
      await expect(caller.mutation(creator.ref, { ...creator.args, projectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    });
    it(`${creator.name}: preserves super_admin pool creation`, async () => {
      const { t, caller } = await fixture("super_admin");
      await caller.mutation(creator.ref, creator.args);
      const rows = await t.run(ctx => ctx.db.query("devices").collect());
      expect(rows).toHaveLength(1);
      expect(rows[0].projectId).toBeUndefined();
      expect(await t.run(ctx => ctx.db.query("adminDevices").collect())).toHaveLength(1);
    });
  }
});

async function tokenFixture(count = 0) {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const ids = await t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", {
      firstName: "Synthetic", lastName: "Employee", email: "test@example.test", cardNumber: "test",
    });
    const insert = (setupToken: string, expiresAt?: number) => ctx.db.insert("employeeAuth", {
      employeeId, setupToken,
      tokenExpiresAt: expiresAt === undefined ? undefined : new Date(expiresAt).toISOString(),
      passwordHash: "unchanged", passwordVersion: 3,
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    });
    const expired = await insert("expired", now - 1);
    const future = await insert("future", now + 86400000);
    const boundary = await insert("boundary", now);
    const noExpiry = await insert("no-expiry");
    for (let i = 0; i < count; i++) await insert(`expired-${i}`, now - 1000);
    return { expired, future, boundary, noExpiry };
  });
  return { t, ...ids };
}

describe("employee setup token cleanup", () => {
  it("clears only strictly expired fields, preserves credentials, and is idempotent", async () => {
    vi.useFakeTimers();
    const { t, expired, future, boundary, noExpiry } = await tokenFixture();
    await t.mutation(internal.employeeAuth.cleanupExpiredSetupTokens, {});
    const row = await t.run(ctx => ctx.db.get(expired));
    expect(row?.setupToken).toBeUndefined();
    expect(row?.tokenExpiresAt).toBeUndefined();
    expect(row).toMatchObject({ passwordHash: "unchanged", passwordVersion: 3 });
    for (const id of [future, boundary, noExpiry]) {
      expect((await t.run(ctx => ctx.db.get(id)))?.setupToken).toBeDefined();
    }
    await t.mutation(internal.employeeAuth.cleanupExpiredSetupTokens, {});
    expect(await t.run(ctx => ctx.db.get(expired))).toEqual(row);
    expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
  });

  it("bounds each scan to 200 rows, schedules and executes continuation", async () => {
    vi.useFakeTimers();
    const { t } = await tokenFixture(398);
    await t.mutation(internal.employeeAuth.cleanupExpiredSetupTokens, {});
    const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe("employeeAuth:cleanupExpiredSetupTokens");
    const remaining = await t.run(ctx => ctx.db.query("employeeAuth").collect());
    expect(remaining.filter(row => row.setupToken?.startsWith("expired"))).toHaveLength(202);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const final = await t.run(ctx => ctx.db.query("employeeAuth").collect());
    expect(final.filter(row => row.setupToken?.startsWith("expired"))).toHaveLength(0);
    expect(final.find(row => row.setupToken === "future")).toBeDefined();
  });

  it("rejects expired tokens before daily cleanup", async () => {
    const { t, expired } = await tokenFixture();
    await expect(t.mutation(internal.employeeAuth.consumeSetupToken, { token: "expired", passwordHash: "replacement" })).resolves.toEqual({ status: "expired" });
    expect((await t.run(ctx => ctx.db.get(expired)))?.passwordHash).toBe("unchanged");
  });
});
