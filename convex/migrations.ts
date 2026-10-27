import { v } from "convex/values";
import { internal } from "./_generated/api";
import { normalizeEmployeeEmail } from "./lib/employeeEmail";
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

/** Approval-only backfill. At most 200 employee records/page and 20 scheduled pages/run.
 * Resume a capped run with its returned cursor and round=0 after reviewing logs.
 * Collisions are checked globally through by_email before each employee is patched.
 */
export const normalizeEmployeeEmails = internalMutation({
  args: {
    cursor: v.optional(v.string()), round: v.optional(v.number()),
    updated: v.optional(v.number()), collisions: v.optional(v.number()),
  },
  returns: v.object({ updated: v.number(), collisions: v.number(), isDone: v.boolean(),
    continueCursor: v.string(), scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const round = args.round ?? 0;
    if (!Number.isInteger(round) || round < 0 || round >= 20) throw new Error("Parti sayısı 0–19 arasında olmalıdır");
    const page = await ctx.db.query("employees").paginate({ numItems: 200, cursor: args.cursor ?? null });
    let updated = args.updated ?? 0;
    let collisions = args.collisions ?? 0;
    for (const employee of page.page) {
      const email = normalizeEmployeeEmail(employee.email);
      const matches = email ? await ctx.db.query("employees")
        .withIndex("by_email", q => q.eq("email", email)).take(2) : [];
      const conflict = matches.find(peer => peer._id !== employee._id);
      if (conflict) {
        collisions++;
        console.warn("Employee email normalization collision", { employeeId: employee._id, conflictingEmployeeId: conflict._id });
        continue;
      }
      if (employee.email !== (email ?? "")) {
        await ctx.db.patch(employee._id, { email: email ?? "" });
        updated++;
      }
      const auth = await ctx.db.query("employeeAuth").withIndex("by_employee", q => q.eq("employeeId", employee._id)).first();
      if (auth && auth.email !== normalizeEmployeeEmail(auth.email)) {
        await ctx.db.patch(auth._id, { email: normalizeEmployeeEmail(auth.email) });
      }
    }
    const scheduled = !page.isDone && round + 1 < 20;
    if (scheduled) await ctx.scheduler.runAfter(0, internal.migrations.normalizeEmployeeEmails, {
      cursor: page.continueCursor, round: round + 1, updated, collisions,
    });
    console.info("Employee email normalization batch", { round, updated, collisions, isDone: page.isDone, cursor: page.continueCursor });
    return { updated, collisions, isDone: page.isDone, continueCursor: page.continueCursor, scheduled };
  },
});

/**
 * Vardiya rengi kaldırıldı (2026-10-26): kayıtlı `shifts.color` alanını siler.
 * İdempotent; sayfa sayfa ilerler. Bittikten sonra şemadan `color` daraltılır.
 */
export const clearShiftColors = internalMutation({
  args: { cursor: v.optional(v.string()), cleared: v.optional(v.number()) },
  returns: v.object({ cleared: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("shifts").paginate({ numItems: 200, cursor: args.cursor ?? null });
    let cleared = args.cleared ?? 0;
    for (const shift of page.page) {
      if (shift.color === undefined) continue;
      await ctx.db.patch(shift._id, { color: undefined });
      cleared++;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.migrations.clearShiftColors, { cursor: page.continueCursor, cleared });
    console.info("Shift color cleanup batch", { cleared, isDone: page.isDone });
    return { cleared, isDone: page.isDone };
  },
});
