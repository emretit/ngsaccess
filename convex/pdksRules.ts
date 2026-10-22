import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { writeAudit } from "./lib/audit";
import { trTodayKey } from "./lib/trDate";
import { addWorkDate } from "./lib/pdksWorkDay";

const choice = v.union(v.literal("absent"), v.literal("review"));
const target = v.object({ targetType: v.union(v.literal("door"), v.literal("device")), deviceId: v.id("devices"), doorId: v.optional(v.id("doors")) });
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
export const getRules = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await resolveProjectScope(ctx, projectId);
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
export const listCheckpointTargets = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await resolveProjectScope(ctx, projectId);
    const [devices, doors] = await Promise.all([
      ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001),
      ctx.db.query("doors").withIndex("by_project", q => q.eq("projectId", projectId)).take(2001),
    ]);
    if (devices.length > 1000 || doors.length > 2000) throw new Error("Kontrol noktası listeleme sınırı aşıldı");
    const devicesById = new Map(devices.map(device => [device._id, device]));
    const doorCounts = new Map<Id<"devices">, number>();
    for (const door of doors) if (door.deviceId) doorCounts.set(door.deviceId, (doorCounts.get(door.deviceId) ?? 0) + 1);
    return {
      devices: devices.map(d => ({ deviceId: d._id, name: d.name, selectable: true, reason: null })),
      doors: doors.map(door => {
        const device = door.deviceId ? devicesById.get(door.deviceId) ?? null : null;
        const reason = checkpointDoorReason(device, door, door.deviceId ? doorCounts.get(door.deviceId) ?? 0 : 0);
        return { doorId: door._id, deviceId: door.deviceId ?? null, name: door.name, selectable: reason === null, reason };
      }),
    };
  },
});
export const publishRuleVersion = adminMutation({
  args: { projectId: v.id("projects"), effectiveFrom: v.string(), punchMode: v.union(v.literal("legacy"), v.literal("requirements")), requireCheckIn: v.optional(v.boolean()), requireCheckOut: v.optional(v.boolean()), missingRequiredPunch: v.optional(choice), noPunch: v.optional(choice), checkpointMode: v.union(v.literal("all"), v.literal("selected")), targets: v.optional(v.array(target)) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom) || !Number.isFinite(Date.parse(args.effectiveFrom)) || new Date(args.effectiveFrom).toISOString().slice(0, 10) !== args.effectiveFrom || args.effectiveFrom < addWorkDate(trTodayKey(), 1)) throw new Error("Yürürlük tarihi en erken yarın olmalıdır");
    if (args.punchMode === "requirements" && [args.requireCheckIn, args.requireCheckOut, args.missingRequiredPunch, args.noPunch].some(value => value === undefined)) throw new Error("Giriş, çıkış ve eksik okutma tercihleri zorunludur");
    if ((args.targets?.length ?? 0) > 500) throw new Error("En fazla 500 kontrol noktası seçilebilir");
    if (args.checkpointMode === "selected" && !args.targets?.length) throw new Error("En az bir kontrol noktası seçin");
    const snapshots = await Promise.all((args.targets ?? []).map(async selection => {
      const device = await ctx.db.get(selection.deviceId);
      if (!device || device.projectId !== args.projectId) throw new Error("Cihaz bu projeye ait değil");
      if (selection.targetType === "device") return { targetType: selection.targetType, deviceId: device._id };
      if (!selection.doorId) throw new Error("Kapı seçimi zorunludur");
      const door = await ctx.db.get(selection.doorId);
      if (!door || door.projectId !== args.projectId || door.deviceId !== device._id) throw new Error("Kapı bu proje ve cihaza ait değil");
      const linked = await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", device._id)).take(501);
      if (linked.length > 500) throw new Error("Cihaz kapı sınırı aşıldı");
      const reason = checkpointDoorReason(device, door, linked.length);
      if (reason) throw new Error(reason);
      return { targetType: selection.targetType, deviceId: device._id, doorId: door._id, ...(device.brand === "ide_smart" ? { ioId: door.ioId } : {}) };
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
export const deleteFutureRuleVersion = adminMutation({
  args: { ruleVersionId: v.id("pdksRuleVersions") },
  handler: async (ctx, { ruleVersionId }) => {
    const version = await ctx.db.get(ruleVersionId);
    if (!version) throw new Error("Kural sürümü bulunamadı");
    await resolveProjectScope(ctx, version.projectId);
    if (version.effectiveFrom <= trTodayKey()) throw new Error("Yürürlüğe girmiş kural silinemez");
    for (const row of await selections(ctx, ruleVersionId)) await ctx.db.delete(row._id);
    await ctx.db.delete(ruleVersionId);
    await writeAudit(ctx, { user: ctx.user, projectId: version.projectId, action: "delete", targetTable: "pdksRuleVersions", targetId: ruleVersionId, oldValue: version });
    return null;
  },
});
