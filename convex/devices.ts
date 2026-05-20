import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  authedQuery,
  authedMutation,
  adminMutation,
  employeeAuthedQuery,
} from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let devices;
    if (ctx.user.role === "super_admin") {
      devices = await ctx.db.query("devices").collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("devices")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      devices = results.flat();
    } else {
      return [];
    }

    return await Promise.all(
      devices.map(async (device) => {
        const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
        const door = device.doorId ? await ctx.db.get(device.doorId) : null;
        return { ...device, zone, door };
      })
    );
  },
});

/**
 * Mobile: Çalışanın erişim yetkisi olan aktif cihazları döner.
 * Akış: groupMembers (employee → group) → groupDevices (group → device) → devices.
 * Sadece `isActive !== false` cihazlar listelenir.
 */
export const listForEmployee = employeeAuthedQuery({
  args: {},
  handler: async (ctx) => {
    const employee = ctx.employee;

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
      )
      .collect();

    if (memberships.length === 0) return [];

    const groupIds = Array.from(new Set(memberships.map((m) => m.groupId)));

    // Sadece aktif erişim kuralları
    const groups = (
      await Promise.all(groupIds.map((gid) => ctx.db.get(gid)))
    ).filter((g): g is NonNullable<typeof g> => g !== null && g.isActive !== false);

    const activeGroupIds = new Set(groups.map((g) => g._id));

    const groupDeviceLinks = await Promise.all(
      Array.from(activeGroupIds).map((gid) =>
        ctx.db
          .query("groupDevices")
          .withIndex("by_project_group", (q) =>
            q.eq("projectId", employee.projectId).eq("groupId", gid),
          )
          .collect()
      )
    );

    const deviceIds = Array.from(
      new Set(groupDeviceLinks.flat().map((link) => link.deviceId))
    );

    if (deviceIds.length === 0) return [];

    const devices = (await Promise.all(deviceIds.map((id) => ctx.db.get(id))))
      .filter((d): d is NonNullable<typeof d> => d !== null && d.isActive !== false);

    return await Promise.all(
      devices.map(async (device) => {
        const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
        const door = device.doorId ? await ctx.db.get(device.doorId) : null;
        return {
          _id: device._id,
          name: device.name,
          deviceSerial: device.deviceSerial ?? null,
          deviceType: device.deviceType ?? null,
          zoneName: zone?.name ?? null,
          doorName: door?.name ?? null,
        };
      })
    );
  },
});

export const getById = authedQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    if (device.projectId && !allowedProjectIds.some((id) => id === device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }
    const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
    const door = device.doorId ? await ctx.db.get(device.doorId) : null;
    return { ...device, zone, door };
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    doorId: v.optional(v.id("doors")),
    deviceType: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    deviceSerial: v.optional(v.string()),
    accessDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    status: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    brand: v.optional(v.union(v.literal("hikvision"), v.literal("other"))),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("devices", {
      ...args,
      isActive: args.isActive ?? true,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
  args: {
    deviceId: v.id("devices"),
    name: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    doorId: v.optional(v.id("doors")),
    deviceType: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    deviceSerial: v.optional(v.string()),
    accessDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    status: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    lastSeen: v.optional(v.string()),
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    brand: v.optional(v.union(v.literal("hikvision"), v.literal("other"))),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    if (device.projectId && !allowedProjectIds.some((id) => id === device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }
    const { deviceId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(deviceId, clean);
    return deviceId;
  },
});

export const remove = authedMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    if (device.projectId && !allowedProjectIds.some((id) => id === device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }
    // İlişkili card readings sayısını kontrol et
    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    await Promise.all(readings.map((r) => ctx.db.delete(r._id)));

    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", args.deviceId),
      )
      .collect();
    await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));

    await ctx.db.delete(args.deviceId);
  },
});

/** HTTP action'dan çağrılır — cihazdan herhangi bir POST gelince lastSeen günceller. */
export const updateLastSeen = internalMutation({
  args: {
    deviceSerial: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    hikDevIndex: v.optional(v.string()),
    ehomeID: v.optional(v.string()),
  },
  handler: async (ctx, { deviceSerial, deviceIp, hikDevIndex, ehomeID }) => {
    const now = new Date().toISOString();
    let device = null;

    if (deviceSerial) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) => q.eq("deviceSerial", deviceSerial))
        .first();
    }
    if (!device && hikDevIndex) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_hik_dev_index", (q) => q.eq("hikDevIndex", hikDevIndex))
        .first();
    }
    if (!device && ehomeID) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_ehome_id", (q) => q.eq("ehomeID", ehomeID))
        .first();
    }
    if (!device && deviceIp) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_ip", (q) => q.eq("deviceIp", deviceIp))
        .first();
    }
    if (device) {
      // Sadece heartbeat/timestamp güncelle. deviceIp/hikDevIndex auto-populate
      // ETMİYORUZ — /card-reader unauth olduğu için saldırgan forged ipAddress
      // veya devIndex yollayarak cihaz lookup index'lerini bozabilir. Bu alanlar
      // sadece trusted yoldan (gateway register / refreshGatewayDeviceStatus) yazılır.
      await ctx.db.patch(device._id, {
        lastSeen: now,
        hikLastSeenAt: Date.now(),
      });
    }
  },
});

// ────────────────────────────────────────────────────────────
// API token — /card-reader HTTP endpoint per-device auth
// ────────────────────────────────────────────────────────────

export const regenerateApiToken = adminMutation({
  args: { deviceId: v.id("devices") },
  returns: v.object({ token: v.string(), createdAt: v.string() }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    if (ctx.user.role !== "super_admin") {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (
        !device.projectId ||
        !allowedProjectIds.some((id) => id === device.projectId)
      ) {
        throw new Error("Bu cihaza erişim yetkiniz yok");
      }
    }
    const token = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await ctx.db.patch(args.deviceId, {
      apiToken: token,
      apiTokenCreatedAt: createdAt,
      updatedAt: createdAt,
    });
    return { token, createdAt };
  },
});

export const getByApiToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_api_token", (q) => q.eq("apiToken", args.token))
      .first();
  },
});

// ────────────────────────────────────────────────────────────
// Hik Device Gateway internal helpers
// ────────────────────────────────────────────────────────────

export const getByIdInternal = internalQuery({
  args: { id: v.id("devices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Gateway'e kayıtlı tüm aktif Hikvision cihazların devIndex listesi.
 * Günlük saat senkronu / nightly reconcile cron'ları kullanır.
 */
export const listRegisteredHikDevIndexes = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const devices = await ctx.db.query("devices").collect();
    return devices
      .filter(
        (d) =>
          d.brand === "hikvision" &&
          !!d.hikDevIndex &&
          d.isActive !== false,
      )
      .map((d) => d.hikDevIndex as string);
  },
});

export const setHikDevIndex = internalMutation({
  args: {
    deviceId: v.id("devices"),
    hikDevIndex: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikDevIndex: args.hikDevIndex ?? undefined,
      hikOfflineHint: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setHikDoorCount = internalMutation({
  args: { deviceId: v.id("devices"), doorCount: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikDoorCount: args.doorCount,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setHikOfflineHint = internalMutation({
  args: { deviceId: v.id("devices"), hint: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikOfflineHint: args.hint,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const applyGatewayHeartbeat = internalMutation({
  args: {
    hikDevIndex: v.string(),
    online: v.boolean(),
    deviceIp: v.optional(v.string()),
    model: v.optional(v.string()),
    /**
     * Caller'ın eriştiği projeler. Boş array verilirse cross-tenant filtre
     * uygulanmaz (sadece super_admin caller'lar için). Aksi halde sadece bu
     * listedeki projelere ait cihaz patch'lenir.
     */
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_hik_dev_index", (q) =>
        q.eq("hikDevIndex", args.hikDevIndex),
      )
      .first();
    if (!device) return false;
    // Scope kontrolü:
    // - undefined → internal trusted caller (cron vb.), filtre yok
    // - [] → caller'ın hiçbir projeye yetkisi yok → deny
    // - non-empty → device.projectId bu listede olmalı; aksi halde deny
    if (args.allowedProjectIds !== undefined) {
      if (!device.projectId) return false;
      if (!args.allowedProjectIds.some((id) => id === device.projectId)) {
        return false;
      }
    }
    const patch: Record<string, unknown> = {
      hikLastSeenAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };
    if (args.online) {
      patch.hikOfflineHint = undefined;
      patch.lastSeen = new Date().toISOString();
    } else {
      patch.hikOfflineHint = "Gateway: offline";
    }
    if (args.deviceIp && !device.deviceIp) patch.deviceIp = args.deviceIp;
    if (args.model && !device.hikModel) patch.hikModel = args.model;
    await ctx.db.patch(device._id, patch);
    return true;
  },
});
