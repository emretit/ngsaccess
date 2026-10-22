
import { ConvexError, v } from "convex/values";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";
import { zoneDeleteBlocker } from "./lib/doorZoneDelete";

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

export const create = adminMutation({
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
    if (!args.projectId) {
      throw new ConvexError("Bölge oluşturmak için bir proje seçmelisiniz");
    }
    if (!isProjectAllowed(allowedProjectIds, args.projectId)) {
      throw new ConvexError("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("zones", { ...args, createdAt: now, updatedAt: now });
  },
});

export const remove = adminMutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new ConvexError("Bölge bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, zone.projectId)) {
      throw new ConvexError("Bu bölgeye erişim yetkiniz yok");
    }
    // Bölge mantıksal alandır; içinde cihaz/kapı varsa silinemez (önce taşı/sil).
    const deviceInZone = await ctx.db
      .query("devices")
      .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
      .first();
    const doorInZone = await ctx.db
      .query("doors")
      .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
      .first();
    const blocker = zoneDeleteBlocker(doorInZone !== null, deviceInZone !== null);
    if (blocker) throw new ConvexError(blocker);
    await ctx.db.delete(args.zoneId);
  },
});
