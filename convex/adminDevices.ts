import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { superAdminQuery, superAdminMutation, adminQuery } from "./lib/customFunctions";
import { purgeDeviceCascade } from "./lib/deviceHelpers";

/**
 * Fiziksel cihaz envanteri (super_admin yönetir).
 * Cihazlar her zaman burada kalır. Projeye atama (claim) sırasında
 * assignedDeviceId / assignedProjectId set edilir; release'de temizlenir.
 */

export const list = superAdminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("adminDevices").collect();
    return await Promise.all(
      rows.map(async (d) => {
        const project = d.assignedProjectId
          ? await ctx.db.get(d.assignedProjectId)
          : null;
        return { ...d, assignedProjectName: project?.name ?? null };
      })
    );
  },
});

/**
 * Claim picker için: sadece atanmamış (assignedDeviceId yok) ve havuzdan gelen cihazlar.
 * adminQuery: project_admin da kendi projesine claim yapabilir.
 */
export const listForClaim = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("adminDevices"),
      name: v.string(),
      brand: v.optional(
        v.union(v.literal("ide_smart"), v.literal("hikvision"), v.literal("other"))
      ),
      ideUuid: v.optional(v.string()),
      ideUser: v.optional(v.string()),
      idePassword: v.optional(v.string()),
      ideDoorCount: v.optional(v.number()),
      lastSeen: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("adminDevices").collect();
    return rows
      .filter((d) => !d.assignedDeviceId && !d.createdFromDevice)
      .map((d) => ({
        _id: d._id,
        name: d.name,
        brand: d.brand,
        ideUuid: d.ideUuid,
        ideUser: d.ideUser,
        idePassword: d.idePassword,
        ideDoorCount: d.ideDoorCount,
        lastSeen: d.lastSeen,
      }));
  },
});

export const register = superAdminMutation({
  args: {
    ideUuid: v.string(),
    name: v.optional(v.string()),
    brand: v.optional(
      v.union(v.literal("ide_smart"), v.literal("hikvision"), v.literal("other"))
    ),
  },
  returns: v.id("adminDevices"),
  handler: async (ctx, args) => {
    const ideUuid = args.ideUuid.trim();
    if (!ideUuid) throw new Error("UUID gerekli");

    const existing = await ctx.db
      .query("adminDevices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
      .first();
    if (existing) throw new Error("Bu UUID zaten kayıtlı");

    const existingDevice = await ctx.db
      .query("devices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
      .first();
    if (existingDevice) throw new Error("Bu UUID zaten bir projeye atanmış cihazda kayıtlı");

    const defaults = await ctx.db.query("ideDefaults").first();
    const ideUser = defaults?.ideUser ?? "admin";
    const idePassword = defaults?.idePassword ?? "admin12345";
    const ideDoorCount = defaults?.ideDoorCount ?? 4;

    const now = new Date().toISOString();
    return await ctx.db.insert("adminDevices", {
      ideUuid,
      name: args.name?.trim() || ideUuid,
      brand: args.brand ?? "ide_smart",
      ideUser,
      idePassword,
      ideHttpPort: 80,
      ideDoorCount,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Mevcut devices kayıtlarını adminDevices'a senkronize eder.
 * adminDeviceId'si olmayan her device için bir adminDevices satırı oluşturur.
 * Idempotent: zaten bağlı olanları atlar.
 */
export const backfillExisting = superAdminMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const allDevices = await ctx.db.query("devices").collect();
    const orphans = allDevices.filter((d) => !d.adminDeviceId);
    const now = new Date().toISOString();
    let count = 0;
    for (const device of orphans) {
      const adminDeviceId = await ctx.db.insert("adminDevices", {
        name: device.name,
        brand: device.brand,
        ideUuid: device.ideUuid,
        deviceSerial: device.deviceSerial,
        ideUser: device.ideUser,
        idePassword: device.idePassword,
        ideHttpPort: device.ideHttpPort,
        ideDoorCount: device.ideDoorCount,
        lastSeen: device.lastSeen,
        assignedDeviceId: device._id,
        assignedProjectId: device.projectId,
        createdFromDevice: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(device._id, { adminDeviceId, updatedAt: now });
      count++;
    }
    return count;
  },
});

export const remove = superAdminMutation({
  args: { adminDeviceId: v.id("adminDevices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.adminDeviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    // Atanmışsa önce projedeki cihazı ve bağlı kayıtlarını (kapı/okuma/grup) temizle,
    // sonra envanter kaydını sil. Böylece tek tıkla tamamen kaldırılabilir.
    if (device.assignedDeviceId) {
      const assigned = await ctx.db.get(device.assignedDeviceId);
      if (assigned) {
        await purgeDeviceCascade(ctx, assigned._id, assigned.projectId);
      }
    }
    await ctx.db.delete(args.adminDeviceId);
  },
});

/** HTTP heartbeat handler'ından çağrılır — atanmamış cihazın lastSeen'ini günceller. */
export const updateLastSeen = internalMutation({
  args: { ideUuid: v.string() },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("adminDevices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid))
      .first();
    if (device) {
      await ctx.db.patch(device._id, { lastSeen: new Date().toISOString() });
    }
  },
});

/** Claim sonrası adminDevices'ı günceller (assignedDeviceId + projectId set eder). */
export const markAssigned = internalMutation({
  args: {
    adminDeviceId: v.id("adminDevices"),
    deviceId: v.id("devices"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.adminDeviceId, {
      assignedDeviceId: args.deviceId,
      assignedProjectId: args.projectId,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Release sonrası adminDevices'ı temizler. */
export const markReleased = internalMutation({
  args: { adminDeviceId: v.id("adminDevices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.adminDeviceId);
    if (!device) return;
    await ctx.db.patch(args.adminDeviceId, {
      assignedDeviceId: undefined,
      assignedProjectId: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});
