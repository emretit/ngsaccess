// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { extractHikCardNo, parseCardReaderBody } from "./lib/cardReaderParse";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it.each([
  { cardReaderNo: 1 },
  { employeeNo: 7, employeeNoString: "0007", cardReaderNo: 1 },
  { cardNumber: "00042", employeeNoString: "7", cardReaderNo: 1 },
])("live and backfill share card identity and queue only one alarm (%j)", async identity => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T10:00:00Z"));
  const t = convexTest(schema, modules);
  const deviceId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "P" });
    await ctx.db.insert("alarmSettings", { projectId, emailEnabled: true, recipients: ["a@example.com"], minSeverity: "warning", updatedAt: "" });
    return ctx.db.insert("devices", { projectId, name: "Hik", createdAt: "", updatedAt: "" });
  });
  const time = new Date().toISOString();
  const payload = { ...identity, cardNo: "", dateTime: time, majorEventType: 1, subEventType: 1030, serialNo: 9 };
  const parsed = parseCardReaderBody(JSON.stringify({ AccessControllerEvent: payload }), "application/json");
  expect(parsed.user_id).toBe(extractHikCardNo(payload));
  await t.mutation(internal.deviceEvents.recordHikDeviceEvent, { deviceId, cardNo: parsed.user_id, eventTime: time, major: 1, minor: 1030, hikSerialNo: 9 });
  expect(await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId, event: { ...identity, time, cardNo: "", major: 1, minor: 1030, serialNo: 9 } })).toMatchObject({ inserted: false, reason: "duplicate" });
  expect(await t.run(ctx => ctx.db.query("deviceEvents").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
});

it.each(["2026-11-28T10:00:00+08:00", "2026-11-28T10:00:00Z"])("device event offsets match in both ingestion orders (%s)", async time => {
  for (const liveFirst of [true, false]) {
    const t = convexTest(schema, modules);
    const deviceId = await t.run(ctx => ctx.db.insert("devices", { name: "Hik", createdAt: "", updatedAt: "" }));
    const live = () => t.mutation(internal.deviceEvents.recordHikDeviceEvent, { deviceId, cardNo: "", eventTime: time, major: 3, minor: 9999, hikSerialNo: 7 });
    const backfill = () => t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId, event: { cardNo: "", time, major: 3, minor: 9999, serialNo: 7 } });
    await (liveFirst ? live() : backfill());
    expect((await (liveFirst ? backfill() : live())).reason).toBe("duplicate");
    const rows = await t.run(ctx => ctx.db.query("deviceEvents").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventTime).toBe(liveFirst ? new Date(time).toISOString() : "2026-11-28T07:00:00.000Z");
  }
});

it.each([
  { route: "ISUP with rewritten offset", liveTime: "2026-11-28T10:00:00+03:00", historyTime: "2026-11-28T10:00:00+08:00" },
  { route: "direct forwarding with correct offset", liveTime: "2026-11-28T10:00:00+03:00", historyTime: "2026-11-28T10:00:00+03:00" },
])("$route followed by backfill retains one device event and one alarm job", async ({ liveTime, historyTime }) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T07:00:00Z"));
  const t = convexTest(schema, modules);
  const deviceId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "P" });
    await ctx.db.insert("alarmSettings", { projectId, emailEnabled: true, recipients: ["a@example.com"], minSeverity: "warning", updatedAt: "" });
    return ctx.db.insert("devices", { projectId, name: "Hik", createdAt: "", updatedAt: "" });
  });
  await t.mutation(internal.deviceEvents.recordHikDeviceEvent, { deviceId, cardNo: "1", eventTime: liveTime, major: 1, minor: 1030, hikSerialNo: 9 });
  const backfill = { deviceId, event: { cardNo: "", cardReaderNo: 1, time: historyTime, major: 1, minor: 1030, serialNo: 9 } };
  expect(await t.mutation(internal.cardReadings.backfillHikEventRow, backfill)).toMatchObject({ inserted: false, reason: "duplicate" });
  expect(await t.mutation(internal.cardReadings.backfillHikEventRow, backfill)).toMatchObject({ inserted: false, reason: "duplicate" });
  const rows = await t.run(ctx => ctx.db.query("deviceEvents").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]?.eventTime).toBe("2026-11-28T07:00:00.000Z");
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
});

it.each([
  { flag: "", url: "https://site.example", host: "site.example" },
  { flag: "1", url: "https://site.example", host: undefined },
  { flag: "1", url: "https://site.example", host: "wrong.example" },
  { flag: "1", url: "https://live.convex.site", host: "live.convex.site" },
])("reconciliation rejects unconfirmed or cloud writes without changing rows (%j)", async ({ flag, url, host }) => {
  vi.stubEnv("SELF_HOST_TARGET", flag); vi.stubEnv("CONVEX_SITE_URL", url);
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { accessExpiresAt: Date.now() + 86400000 }));
  expect((await t.mutation(internal.selfHostReconcile.reconcile, { table: "users", dryRun: true })).affected).toBe(1);
  await expect(t.mutation(internal.selfHostReconcile.reconcile, { table: "users", dryRun: false, confirmHost: host })).rejects.toThrow("Self-host hedef kilidi");
  expect((await t.run(ctx => ctx.db.get(userId)))?.accessExpiryJobId).toBeUndefined();
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
});
