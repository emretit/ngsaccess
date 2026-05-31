import { internalMutation, internalQuery } from "./_generated/server";

/**
 * One-off migration'lar. `npx convex run migrations:<ad>` ile çalıştırılır.
 * Çalıştıktan sonra (data temizlendikten sonra) kaldırılabilirler.
 */

/**
 * Bölge↔panel ayrıştırması (Variant 1) için backfill:
 * Eski modelde panele ait bölge `zone.ideDeviceId` ile, kapılar `door.zoneId` ile
 * tutuluyordu. Yeni modelde kapının paneli `door.deviceId`'de. Bu migration, eski
 * panel-bölgelerin kapılarına `deviceId`'yi yazar.
 *
 * Tahribatsız + idempotent: yalnızca `door.deviceId` boş olan kapılara yazar;
 * `zone.ideDeviceId` (deprecated) DOKUNULMAZ (geri-okuma kaynağı olarak bırakılır).
 * Dönüş: kaç kapının güncellendiği + kaç panel-bölge bulunduğu.
 */
export const backfillDoorDeviceId = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ panelZones: number; doorsUpdated: number }> => {
    const now = new Date().toISOString();
    let panelZones = 0;
    let doorsUpdated = 0;

    const zones = await ctx.db.query("zones").collect();
    for (const zone of zones) {
      if (!zone.ideDeviceId) continue;
      panelZones++;
      const doors = await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", zone._id))
        .collect();
      for (const door of doors) {
        if (door.deviceId) continue; // zaten backfill edilmiş
        await ctx.db.patch(door._id, {
          deviceId: zone.ideDeviceId,
          updatedAt: now,
        });
        doorsUpdated++;
      }
    }

    return { panelZones, doorsUpdated };
  },
});

/**
 * Yetim panel-bölgesi temizliği: `zone.ideDeviceId` dolu AMA işaret ettiği cihaz
 * artık yok olan bölgeleri ve altındaki kapıları siler (silinmiş panelden kalan
 * yetimler). Aktif cihazı olan bölgelere DOKUNMAZ. Dönüş: silinen bölge/kapı sayısı.
 */
export const cleanupOrphanPanelZones = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ zonesDeleted: number; doorsDeleted: number }> => {
    let zonesDeleted = 0;
    let doorsDeleted = 0;

    const zones = await ctx.db.query("zones").collect();
    for (const zone of zones) {
      if (!zone.ideDeviceId) continue;
      const device = await ctx.db.get(zone.ideDeviceId);
      if (device) continue; // cihaz hâlâ var → yetim değil, dokunma

      const doors = await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", zone._id))
        .collect();
      for (const door of doors) {
        await ctx.db.delete(door._id);
        doorsDeleted++;
      }
      await ctx.db.delete(zone._id);
      zonesDeleted++;
    }

    return { zonesDeleted, doorsDeleted };
  },
});

/**
 * Salt-okunur doğrulama: her IDE paneli için bağlı kapı/io listesi + bölge.
 * `npx convex run migrations:verifyDecouple` ile JSON döner.
 */
export const verifyDecouple = internalQuery({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();
    const panels = devices.filter((d) => d.brand === "ide_smart");
    const out = [];
    for (const panel of panels) {
      const doors = await ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", panel._id))
        .collect();
      const zone = panel.zoneId ? await ctx.db.get(panel.zoneId) : null;
      out.push({
        panelName: panel.name,
        zoneName: zone?.name ?? null,
        doorCount: doors.length,
        ioIds: doors
          .map((d) => d.ioId)
          .filter((io): io is number => typeof io === "number")
          .sort((a, b) => a - b),
        doorsMissingDeviceLink: doors.filter((d) => !d.deviceId).length,
      });
    }
    // Hâlâ ideDeviceId taşıyan (deprecated) bölge sayısı.
    const zones = await ctx.db.query("zones").collect();
    return {
      panels: out,
      deprecatedZoneLinks: zones.filter((z) => z.ideDeviceId).length,
    };
  },
});
