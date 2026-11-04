// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { loadPdksRulePolicy, matchesPdksCheckpoint } from "./lib/pdksRules";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function fixture(brand: "hikvision" | "ide_smart" = "hikvision") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100 * 86400000 });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Cihaz", brand, createdAt: "", updatedAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Kapı", ioId: 1 });
    const targetDoorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Yeni kapı", ioId: 2 });
    const readerId = await ctx.db.insert("readers", { projectId, deviceId, doorId, name: "Okuyucu", direction: "both", hikReaderNo: 1, ioId: 1, createdAt: "", updatedAt: "" });
    return { projectId, userId, sessionId, deviceId, doorId, targetDoorId, readerId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const args = { projectId: ids.projectId, effectiveFrom: "2026-10-23", punchMode: "legacy" as const, checkpointMode: "selected" as const,
    targets: [{ targetType: "reader" as const, deviceId: ids.deviceId, doorId: ids.doorId, readerId: ids.readerId }] };
  const readPolicy = (date = "2026-10-23") => t.run(async ctx => (await loadPdksRulePolicy(ctx, ids.projectId, date, date))(date));
  return { t, caller, args, readPolicy, ...ids };
}

it("PDK-003: Hik 1 geçmişi düzenleme/taşıma/silmede korunur; yeni sürüm güncel adresi alır", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  const event = { deviceId: f.deviceId, hikCardReaderNo: 1 };
  expect(matchesPdksCheckpoint(event, await f.readPolicy())).toBe(true);
  await f.caller.mutation(api.readers.update, { readerId: f.readerId, hikReaderNo: 2 });
  expect(matchesPdksCheckpoint(event, await f.readPolicy())).toBe(true);
  expect(matchesPdksCheckpoint({ ...event, hikCardReaderNo: 2 }, await f.readPolicy())).toBe(false);
  await f.caller.mutation(api.readers.move, { readerId: f.readerId, targetDoorId: f.targetDoorId, direction: "both" });
  expect(matchesPdksCheckpoint(event, await f.readPolicy())).toBe(true);
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-24", targets: [{ ...f.args.targets[0], doorId: f.targetDoorId }] });
  expect(matchesPdksCheckpoint(event, await f.readPolicy("2026-10-24"))).toBe(false);
  expect(matchesPdksCheckpoint({ ...event, hikCardReaderNo: 2 }, await f.readPolicy("2026-10-24"))).toBe(true);
  await f.caller.mutation(api.readers.remove, { readerId: f.readerId });
  expect(matchesPdksCheckpoint(event, await f.readPolicy())).toBe(true);
  expect(matchesPdksCheckpoint({ ...event, hikCardReaderNo: 2 }, await f.readPolicy("2026-10-24"))).toBe(true);
  expect(matchesPdksCheckpoint({ ...event, deviceId: "another-device" }, await f.readPolicy())).toBe(false);
  // Stored addresses require no lookup of a deleted reader.
  await f.t.run(async ctx => {
    const get = vi.spyOn(ctx.db, "get");
    await loadPdksRulePolicy(ctx, f.projectId, "2026-10-23", "2026-10-24");
    expect(get).not.toHaveBeenCalled();
    get.mockRestore();
    // Traffic at the saved address remains known after deleting the live reader.
    await ctx.db.insert("cardReadings", { projectId: f.projectId, deviceId: f.deviceId, cardNo: "123", hikCardReaderNo: 1, accessTime: "2026-10-21T06:00:00.000Z", accessStatus: "izin_verildi" });
  });
  expect(await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId })).toEqual([]);
});

it("IDE cihaz+IO adresi taşıma ve silmede korunur; yeni sürüm yeni IO kullanır", async () => {
  const f = await fixture("ide_smart");
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  await f.caller.mutation(api.readers.move, { readerId: f.readerId, targetDoorId: f.targetDoorId, direction: "both" });
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-24", targets: [{ ...f.args.targets[0], doorId: f.targetDoorId }] });
  await f.caller.mutation(api.readers.remove, { readerId: f.readerId });
  const old = await f.readPolicy();
  expect(matchesPdksCheckpoint({ deviceId: f.deviceId, ideIoId: 1 }, old)).toBe(true);
  expect(matchesPdksCheckpoint({ deviceId: f.deviceId, ideIoId: 2 }, old)).toBe(false);
  expect(matchesPdksCheckpoint({ deviceId: f.deviceId, hikCardReaderNo: 1 }, old)).toBe(false);
  expect(matchesPdksCheckpoint({ deviceId: f.deviceId, ideIoId: 2 }, await f.readPolicy("2026-10-24"))).toBe(true);
  expect(await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId })).toEqual([]);
});

it("adressiz eski sürüm güncel okuyucuya düşer ve belirsizliğini bildirir", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const ruleVersionId = await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-10-01", punchMode: "legacy", checkpointMode: "selected", createdAt: "", createdBy: f.userId });
    await ctx.db.insert("pdksCheckpointSelections", { ...f.args.targets[0], projectId: f.projectId, ruleVersionId });
  });
  const event = { deviceId: f.deviceId, hikCardReaderNo: 1 };
  expect(matchesPdksCheckpoint(event, await f.readPolicy())).toBe(true);
  await f.caller.mutation(api.readers.update, { readerId: f.readerId, hikReaderNo: 2 });
  const policy = await f.readPolicy();
  expect(matchesPdksCheckpoint(event, policy)).toBe(false);
  expect(matchesPdksCheckpoint({ ...event, hikCardReaderNo: 2 }, policy)).toBe(true);
  expect(policy).toMatchObject({ checkpointAddressUncertain: true, targets: [{ addressUncertain: true }] });
  const warnings = await f.caller.query(api.pdksRules.getCheckpointWarnings, { projectId: f.projectId });
  expect(warnings).toEqual([expect.objectContaining({ message: expect.stringContaining("okuyucu numarası kayıtlı değil") })]);
  await f.caller.mutation(api.readers.remove, { readerId: f.readerId });
  expect(await f.readPolicy()).toMatchObject({ checkpointAddressUncertain: true });
  expect(matchesPdksCheckpoint({ ...event, hikCardReaderNo: 2 }, await f.readPolicy())).toBe(false);
});
