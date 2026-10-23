import { resolveProjectScope } from "./lib/projectScope";
import { requirePermission } from "./lib/permissions";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";
import { trTodayKey } from "./lib/trDate";
import { addWorkDate } from "./lib/pdksWorkDay";

const choice = v.union(v.literal("absent"), v.literal("review"));
const target = v.object({
  targetType: v.union(v.literal("door"), v.literal("device"), v.literal("reader")),
  deviceId: v.id("devices"), doorId: v.optional(v.id("doors")), readerId: v.optional(v.id("readers")),
  pointType: v.optional(v.union(v.literal("both"), v.literal("entry"), v.literal("exit"))),
});
export function checkpointReaderReason(device: Doc<"devices"> | null, reader: Pick<Doc<"readers">, "hikReaderNo" | "ioId">): string | null {
  if (!device) return "Okuyucu bir cihaza bağlı değil";
  return device.brand === "ide_smart"
    ? reader.ioId === undefined ? "Okuyucunun fiziksel IO eşlemesi eksik" : null
    : reader.hikReaderNo === undefined ? "Okuyucunun Hik numarası eksik" : null;
}
async function selections(ctx: QueryCtx | MutationCtx, ruleVersionId: Id<"pdksRuleVersions">) {
  const rows = await ctx.db.query("pdksCheckpointSelections").withIndex("by_ruleVersionId", q => q.eq("ruleVersionId", ruleVersionId)).take(501);
  if (rows.length > 500) throw new Error("PDKS kural sürümü en fazla 500 hedef içerebilir");
  return rows;
}
export function checkpointDoorReason(device: Doc<"devices"> | null, door: Pick<Doc<"doors">, "ioId">, linkedDoorCount: number): string | null {
  if (!device) return "Kapı bir cihaza bağlı değil";
  if (device.brand === "ide_smart") return door.ioId === undefined ? "Kapının fiziksel IO eşlemesi eksik" : null;
  return Math.max(device.doorCount ?? 0, device.hikDoorCount ?? 0, linkedDoorCount) === 1 ? null : "Çok kapılı cihazda okumalar kapı numarası taşımıyor; cihazın tüm geçişlerini seçin";
}
export const getRules = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await resolveProjectScope(ctx, projectId);
    await requirePermission(ctx, ctx.user, projectId, "schedule.manage");
    const today = trTodayKey();
    const [past, future] = await Promise.all([
      ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).lte("effectiveFrom", today)).order("desc").take(21),
      ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).gt("effectiveFrom", today)).take(65),
    ]);
    if (future.length > 64) throw new Error("64'ten fazla gelecek PDKS sürümü var");
    const enrich = async (version: Doc<"pdksRuleVersions">) => ({ ...version, targets: await selections(ctx, version._id) });
    return { current: past[0] ? await enrich(past[0]) : null, future: await Promise.all(future.map(enrich)), history: await Promise.all(past.slice(1).map(enrich)) };
  },
});
export const listCheckpointTargets = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await resolveProjectScope(ctx, projectId);
    await requirePermission(ctx, ctx.user, projectId, "schedule.manage");
    const [devices, doors, readers] = await Promise.all([
      ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001),
      ctx.db.query("doors").withIndex("by_project", q => q.eq("projectId", projectId)).take(2001),
      ctx.db.query("readers").withIndex("by_project", q => q.eq("projectId", projectId)).take(4001),
    ]);
    if (devices.length > 1000 || doors.length > 2000 || readers.length > 4000) throw new Error("Kontrol noktası listeleme sınırı aşıldı");
    const devicesById = new Map(devices.map(device => [device._id, device]));
    const doorsById = new Map(doors.map(door => [door._id, door]));
    const doorCounts = new Map<Id<"devices">, number>();
    for (const door of doors) if (door.deviceId) doorCounts.set(door.deviceId, (doorCounts.get(door.deviceId) ?? 0) + 1);
    return {
      devices: devices.map(d => ({ deviceId: d._id, name: d.name, selectable: true, reason: null })),
      readers: readers.map(reader => {
        const device = reader.deviceId ? devicesById.get(reader.deviceId) ?? null : null;
        const door = reader.doorId ? doorsById.get(reader.doorId) : undefined;
        const reason = !door || door.deviceId !== reader.deviceId ? "Okuyucunun kapı eşlemesi eksik" : checkpointReaderReason(device, reader);
        return { readerId: reader._id, doorId: reader.doorId, deviceId: reader.deviceId ?? null,
          name: reader.name, direction: reader.direction, hikReaderNo: reader.hikReaderNo, selectable: reason === null, reason };
      }),
      doors: doors.map(door => {
        const device = door.deviceId ? devicesById.get(door.deviceId) ?? null : null;
        const reason = checkpointDoorReason(device, door, door.deviceId ? doorCounts.get(door.deviceId) ?? 0 : 0);
        return { doorId: door._id, deviceId: door.deviceId ?? null, name: door.name, selectable: reason === null, reason };
      }),
    };
  },
});
export const publishRuleVersion = authedMutation({
  args: { projectId: v.id("projects"), effectiveFrom: v.string(), calculationMode: v.optional(v.union(v.literal("firstLast"), v.literal("eachPunch"))), minPunchIntervalMinutes: v.optional(v.number()), punchMode: v.union(v.literal("legacy"), v.literal("requirements")), requireCheckIn: v.optional(v.boolean()), requireCheckOut: v.optional(v.boolean()), missingRequiredPunch: v.optional(choice), noPunch: v.optional(choice), checkpointMode: v.union(v.literal("all"), v.literal("selected")), targets: v.optional(v.array(target)) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    await requirePermission(ctx, ctx.user, args.projectId, "schedule.manage");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom) || !Number.isFinite(Date.parse(args.effectiveFrom)) || new Date(args.effectiveFrom).toISOString().slice(0, 10) !== args.effectiveFrom || args.effectiveFrom < addWorkDate(trTodayKey(), 1)) throw new Error("Yürürlük tarihi en erken yarın olmalıdır");
    if (args.minPunchIntervalMinutes !== undefined && (!Number.isFinite(args.minPunchIntervalMinutes) || args.minPunchIntervalMinutes < 0 || args.minPunchIntervalMinutes > 60)) throw new Error("Tekrar okutma aralığı 0–60 dakika olmalı");
    if (args.punchMode === "requirements" && [args.requireCheckIn, args.requireCheckOut, args.missingRequiredPunch, args.noPunch].some(value => value === undefined)) throw new Error("Giriş, çıkış ve eksik okutma tercihleri zorunludur");
    if ((args.targets?.length ?? 0) > 500) throw new Error("En fazla 500 kontrol noktası seçilebilir");
    if (args.checkpointMode === "selected" && !args.targets?.length) throw new Error("En az bir kontrol noktası seçin");
    const keys = new Set<string>();
    for (const selection of args.targets ?? []) {
      if (selection.targetType !== "device" && !selection.doorId) throw new Error("Kapı seçimi zorunludur");
      if (selection.targetType === "reader" && !selection.readerId) throw new Error("Okuyucu seçimi zorunludur");
      const key = `${selection.targetType}:${selection.targetType === "reader" ? selection.readerId : selection.targetType === "door" ? selection.doorId : selection.deviceId}`;
      if (keys.has(key)) throw new Error("Aynı kontrol noktası birden fazla seçilemez");
      keys.add(key);
    }
    // Overlapping device/door/reader selections are intentional: the most specific
    // matching target owns direction, including an explicit/default `both`.
    const readerAddresses = new Set<string>();
    const snapshots = await Promise.all((args.targets ?? []).map(async selection => {
      const device = await ctx.db.get(selection.deviceId);
      if (!device || device.projectId !== args.projectId) throw new Error("Cihaz bu projeye ait değil");
      if (selection.targetType === "device") return { targetType: selection.targetType, deviceId: device._id, pointType: selection.pointType };
      if (!selection.doorId) throw new Error("Kapı seçimi zorunludur");
      const door = await ctx.db.get(selection.doorId);
      if (!door || door.projectId !== args.projectId || door.deviceId !== device._id) throw new Error("Kapı bu proje ve cihaza ait değil");
      if (selection.targetType === "reader") {
        if (!selection.readerId) throw new Error("Okuyucu seçimi zorunludur");
        const reader = await ctx.db.get(selection.readerId);
        if (!reader || reader.projectId !== args.projectId || reader.deviceId !== device._id || reader.doorId !== door._id) throw new Error("Okuyucu bu proje, cihaz ve kapıya ait değil");
        const reason = checkpointReaderReason(device, reader);
        if (reason) throw new Error(reason);
        const address = `${device._id}:${device.brand === "ide_smart" ? `io:${reader.ioId}` : `hik:${reader.hikReaderNo}`}`;
        if (readerAddresses.has(address)) throw new Error("Aynı fiziksel okuyucu eşlemesi birden fazla seçilemez");
        readerAddresses.add(address);
        return { targetType: selection.targetType, deviceId: device._id, doorId: door._id, readerId: reader._id,
          pointType: selection.pointType, ...(device.brand === "ide_smart" ? { ioId: reader.ioId } : {}) };
      }
      const linked = await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", device._id)).take(501);
      if (linked.length > 500) throw new Error("Cihaz kapı sınırı aşıldı");
      const reason = checkpointDoorReason(device, door, linked.length);
      if (reason) throw new Error(reason);
      return { targetType: selection.targetType, deviceId: device._id, doorId: door._id, pointType: selection.pointType, ...(device.brand === "ide_smart" ? { ioId: door.ioId } : {}) };
    }));
    const existing = await ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", args.projectId).eq("effectiveFrom", args.effectiveFrom)).unique();
    const { targets: _targets, ...fields } = args;
    const data = { ...fields, createdAt: new Date().toISOString(), createdBy: ctx.user._id };
    let id: Id<"pdksRuleVersions">;
    if (existing) {
      if (existing.effectiveFrom <= trTodayKey()) throw new Error("Yürürlüğe girmiş kural değiştirilemez");
      id = existing._id;
      for (const row of await selections(ctx, id)) await ctx.db.delete(row._id);
      await ctx.db.replace(id, data);
    } else id = await ctx.db.insert("pdksRuleVersions", data);
    for (const snapshot of snapshots) await ctx.db.insert("pdksCheckpointSelections", { ...snapshot, projectId: args.projectId, ruleVersionId: id });
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: existing ? "update" : "create", targetTable: "pdksRuleVersions", targetId: id, oldValue: existing, newValue: data });
    return id;
  },
});
export const deleteFutureRuleVersion = authedMutation({
  args: { ruleVersionId: v.id("pdksRuleVersions") },
  handler: async (ctx, { ruleVersionId }) => {
    const version = await ctx.db.get(ruleVersionId);
    if (!version) throw new Error("Kural sürümü bulunamadı");
    await resolveProjectScope(ctx, version.projectId);
    await requirePermission(ctx, ctx.user, version.projectId, "schedule.manage");
    if (version.effectiveFrom <= trTodayKey()) throw new Error("Yürürlüğe girmiş kural silinemez");
    for (const row of await selections(ctx, ruleVersionId)) await ctx.db.delete(row._id);
    await ctx.db.delete(ruleVersionId);
    await writeAudit(ctx, { user: ctx.user, projectId: version.projectId, action: "delete", targetTable: "pdksRuleVersions", targetId: ruleVersionId, oldValue: version });
    return null;
  },
});
