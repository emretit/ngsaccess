import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  authedQuery,
  authedMutation,
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
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
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
          .withIndex("by_group", (q) => q.eq("groupId", gid))
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
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
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
  },
  handler: async (ctx, { deviceSerial, deviceIp }) => {
    const now = new Date().toISOString();
    let device = null;

    if (deviceSerial) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) => q.eq("deviceSerial", deviceSerial))
        .first();
    }
    if (!device && deviceIp) {
      device = await ctx.db
        .query("devices")
        .filter((q) => q.eq(q.field("deviceIp"), deviceIp))
        .first();
    }
    if (device) {
      await ctx.db.patch(device._id, { lastSeen: now });
    }
  },
});
