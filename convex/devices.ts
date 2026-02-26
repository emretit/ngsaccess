import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let devices;
    if (args.isSuperAdmin) {
      devices = await ctx.db.query("devices").collect();
    } else if (args.projectIds && args.projectIds.length > 0) {
      const results = await Promise.all(
        args.projectIds.map((pid) =>
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

export const getById = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
    const door = device.doorId ? await ctx.db.get(device.doorId) : null;
    return { ...device, zone, door };
  },
});

export const create = mutation({
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
  },
  handler: async (ctx, args) => {
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

export const update = mutation({
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
  },
  handler: async (ctx, args) => {
    const { deviceId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(deviceId, clean);
    return deviceId;
  },
});

export const remove = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
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
