
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId) {
      // Aktif proje filtresi — super_admin dahil yalnızca seçili projenin bölgeleri.
      if (!allowedProjectIds.some((id) => id === args.projectId)) return [];
      return await ctx.db
        .query("zones")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    }
    if (ctx.user.role === "super_admin") return await ctx.db.query("zones").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("zones")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = authedMutation({
  // Bölge = saf mantıksal alan. ideDeviceId KABUL EDİLMEZ (panel↔bölge 1:1 bağı
  // kaldırıldı; kapının paneli doors.deviceId'de). Eski deprecated alanı yazma
  // yüzeyi kapatıldı — aksi halde yeni orphan panel-bölge üretilebilirdi.
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("zones", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = authedMutation({
  args: {
    zoneId: v.id("zones"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Bölge bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, zone.projectId)) {
      throw new Error("Bu bölgeye erişim yetkiniz yok");
    }
    const { zoneId, ...updates } = args;
    await ctx.db.patch(zoneId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Bölge bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, zone.projectId)) {
      throw new Error("Bu bölgeye erişim yetkiniz yok");
    }
    // Bölge mantıksal alandır; içinde cihaz/kapı varsa silinemez (önce taşı/sil).
    const deviceInZone = await ctx.db
      .query("devices")
      .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
      .first();
    if (deviceInZone) {
      throw new Error(
        "Bu bölgede cihaz var — önce cihazları başka bölgeye taşıyın veya silin.",
      );
    }
    const doorInZone = await ctx.db
      .query("doors")
      .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
      .first();
    if (doorInZone) {
      throw new Error(
        "Bu bölgede kapı var — önce kapıları başka bölgeye taşıyın veya silin.",
      );
    }
    await ctx.db.delete(args.zoneId);
  },
});
