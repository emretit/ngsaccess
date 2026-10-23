// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

async function fixture(checkpointMode: "all" | "selected" = "selected") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100 * 86400000 });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", doorCount: 1, hikDevIndex: "dev-test", apiToken: "test-token", createdAt: "", updatedAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Kapı" });
    const readerId = await ctx.db.insert("readers", { projectId, deviceId, doorId, name: "İç okuyucu", direction: "exit", hikReaderNo: 2, createdAt: "", updatedAt: "" });
    await ctx.db.insert("readers", { projectId, deviceId, doorId, name: "Dış okuyucu", direction: "entry", hikReaderNo: 1, createdAt: "", updatedAt: "" });
    const ruleVersionId = await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-10-01", punchMode: "legacy", checkpointMode, createdAt: "", createdBy: userId });
    await ctx.db.insert("pdksCheckpointSelections", { projectId, ruleVersionId, targetType: "reader", deviceId, doorId, readerId, pointType: "exit" });
    const reading = (accessTime: string, hikCardReaderNo?: number) => ctx.db.insert("cardReadings", { projectId, deviceId, cardNo: "TEST", accessTime, accessStatus: "izin_verildi", hikCardReaderNo });
    await reading("2026-10-21T06:00:00.000Z", 1);
    await reading("2026-10-21T14:00:00.000Z", 2);
    await reading("2026-10-21T15:00:00.000Z", 4);
    await reading("2026-10-20T15:00:00.000Z", 3);
    await reading("2026-10-21T16:00:00.000Z");
    await reading("2026-10-22T08:00:00.000Z", 6); // bugün: sorguya girmez
    await reading("2026-10-10T08:00:00.000Z", 8); // 7 günden eski
    return { projectId, userId, sessionId, deviceId, doorId, readerId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { t, caller, ...ids };
}

it("warns about reader numbers the device sends but no reader owns, within the last 7 days before today", async () => {
  const f = await fixture();
  const warnings = await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId });
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe(`unknown:${f.deviceId}`);
  expect(warnings[0].message).toContain("3, 4 numaralı okuyucudan");
  expect(warnings[0].message).toContain("bugün hariç son 7 günde");
});

it("warns when a selected reader is deleted, moved or has no number", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { await ctx.db.patch(f.readerId, { hikReaderNo: undefined }); });
  expect((await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId })).map(w => w.key)).toEqual([`number:${f.readerId}`]);
  await f.t.run(async ctx => { await ctx.db.patch(f.readerId, { hikReaderNo: 2, doorId: await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Yan kapı" }) }); });
  expect((await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId })).map(w => w.key)).toEqual([`moved:${f.readerId}:2026-10-01`]);
  await f.t.run(async ctx => { await ctx.db.delete(f.readerId); });
  const warnings = await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId });
  expect(warnings.map(w => w.key)).toEqual([`moved:${f.readerId}:2026-10-01`]);
  expect(warnings[0].message).toContain("silinmiş ya da başka kapıya taşınmış");
});

it("stays silent when no reader is selected", async () => {
  const f = await fixture("all");
  expect(await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId })).toEqual([]);
});

it("a valid future selection does not hide a broken current one", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const newDoor = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Yeni kapı" });
    await ctx.db.patch(f.readerId, { doorId: newDoor });
    const future = await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-10-30", punchMode: "legacy", checkpointMode: "selected", createdAt: "", createdBy: f.userId });
    await ctx.db.insert("pdksCheckpointSelections", { projectId: f.projectId, ruleVersionId: future, targetType: "reader", deviceId: f.deviceId, doorId: newDoor, readerId: f.readerId, pointType: "exit" });
  });
  const keys = (await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId })).map(w => w.key);
  expect(keys).toContain(`moved:${f.readerId}:2026-10-01`);
  expect(keys).not.toContain(`moved:${f.readerId}:2026-10-30`);
});

it("other devices' traffic and other projects' readers do not hide an unknown number", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const other = await ctx.db.insert("devices", { projectId: f.projectId, name: "Turnike", brand: "hikvision", doorCount: 1, hikDevIndex: "dev-2", apiToken: "token-2", createdAt: "", updatedAt: "" });
    for (let i = 0; i < 510; i++) await ctx.db.insert("cardReadings", { projectId: f.projectId, deviceId: other, cardNo: "BUSY", accessTime: `2026-10-21T20:${String(i % 60).padStart(2, "0")}:${String(Math.floor(i / 60)).padStart(2, "0")}.000Z`, accessStatus: "izin_verildi", hikCardReaderNo: 1 });
    const foreign = await ctx.db.insert("projects", { name: "Diğer" });
    const foreignDoor = await ctx.db.insert("doors", { projectId: foreign, deviceId: f.deviceId, name: "Yabancı kapı" });
    await ctx.db.insert("readers", { projectId: foreign, deviceId: f.deviceId, doorId: foreignDoor, name: "Yabancı", direction: "entry", hikReaderNo: 3, createdAt: "", updatedAt: "" });
  });
  const warnings = await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId });
  expect(warnings.map(w => w.key)).toEqual([`unknown:${f.deviceId}`]);
  expect(warnings[0].message).toContain("3, 4 numaralı okuyucudan");
});
