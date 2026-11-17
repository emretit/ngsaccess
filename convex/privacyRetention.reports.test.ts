// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-03-31T09:00:00Z");
const cutoff = Date.parse("2025-02-28T09:00:00Z");
afterEach(() => vi.useRealTimers());
async function seed(ctx: MutationCtx, time: number) {
  const userId = await ctx.db.insert("users", {});
  const scheduleId = await ctx.db.insert("reportScheduleSettings", {
    userId, email: "test@example.test", enabled: false, reportType: "sgk", updatedAt: "now", createdAt: "now",
  });
  return { scheduleId, fields: { scheduleId, year: 2025, month: 1, scheduleUpdatedAt: "now",
    email: "test@example.test", reportType: "sgk", status: "sent" as const, attempts: 1, lastAttemptAt: time } };
}

it("deletes older than 13 calendar months in bounded batches, including old orphans, and keeps the boundary and recent rows", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const keep = await t.run(async ctx => {
    const { scheduleId, fields } = await seed(ctx, cutoff - 1);
    for (let i = 0; i < 450; i++) await ctx.db.insert("reportDeliveries", fields);
    await ctx.db.delete(scheduleId);
    return [
      await ctx.db.insert("reportDeliveries", { ...fields, lastAttemptAt: cutoff }),
      await ctx.db.insert("reportDeliveries", { ...fields, lastAttemptAt: now }),
    ];
  });
  await t.mutation(internal.privacyRetention.purgeReportDeliveries, {});
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").collect())).toHaveLength(252);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").collect())).toHaveLength(2);
  for (const id of keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
});

it("limits the daily delivery purge to 20 batches and drains the remaining backlog next day", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const { fields } = await seed(ctx, cutoff - 1);
    for (let i = 0; i < 4100; i++) await ctx.db.insert("reportDeliveries", fields);
  });
  await t.mutation(internal.privacyRetention.purgeReportDeliveries, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").collect())).toHaveLength(100);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(19);
  vi.setSystemTime(now + 86_400_000);
  await t.mutation(internal.privacyRetention.purgeReportDeliveries, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").collect())).toHaveLength(0);
});
