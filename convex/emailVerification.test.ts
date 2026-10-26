// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
it("clears 450 expired tokens over three scheduled pages, preserving valid and unset expiries", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T00:00:00.000Z"));
  const t = convexTest(schema, modules);
  const keep = await t.run(async ctx => {
    for (let i = 0; i < 450; i++) await ctx.db.insert("users", { setupToken: `expired-${i}`, tokenExpiresAt: "2026-01-01T00:00:00.000Z" });
    return [await ctx.db.insert("users", { setupToken: "valid", tokenExpiresAt: "2030-01-01T00:00:00.000Z" }), await ctx.db.insert("users", { setupToken: "no-expiry" })];
  });
  await t.mutation(internal.emailVerification.cleanupExpiredTokens, {});
  expect(await t.run(ctx => ctx.db.query("users").withIndex("by_tokenExpiresAt", q => q.eq("tokenExpiresAt", "2026-01-01T00:00:00.000Z")).collect())).toHaveLength(250);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("users").withIndex("by_tokenExpiresAt", q => q.eq("tokenExpiresAt", "2026-01-01T00:00:00.000Z")).collect())).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(2);
  for (const id of keep) expect((await t.run(ctx => ctx.db.get(id)))?.setupToken).toBeTruthy();
});
it("does not schedule beyond the daily chain limit", async () => {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { setupToken: "expired", tokenExpiresAt: "2000-01-01T00:00:00.000Z" }));
  await t.mutation(internal.emailVerification.cleanupExpiredTokens, { batch: 20 });
  expect((await t.run(ctx => ctx.db.query("users").first()))?.setupToken).toBe("expired");
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
});
