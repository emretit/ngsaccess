import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { classifyHikEvent } from "./lib/hikEventCatalog";

const SOURCE_VALIDATOR = v.union(
  v.literal("hikvision"),
  v.literal("ide_smart"),
  v.literal("system"),
);

const trimOptional = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const truncateRawData = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  return value.length > 10000 ? value.slice(0, 10000) : value;
};

export const listForDevice = authedQuery({
  args: {
    deviceId: v.id("devices"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return [];

    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
    return await ctx.db
      .query("deviceEvents")
      .withIndex("by_device_and_event_time", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(limit);
  },
});

export const recordSystemOperation = authedMutation({
  args: {
    deviceId: v.id("devices"),
    label: v.string(),
    ok: v.boolean(),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ inserted: boolean }> => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Cihaz bulunamadı");
    }

    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }

    const now = new Date().toISOString();
    await ctx.db.insert("deviceEvents", {
      projectId: device.projectId,
      deviceId: args.deviceId,
      source: "system",
      eventTime: now,
      category: "operation",
      severity: args.ok ? "info" : "warning",
      label: trimOptional(args.label) ?? "Cihaz operasyonu",
      rawData: truncateRawData(args.rawData),
      deviceSerial: trimOptional(device.deviceSerial),
      deviceIp: trimOptional(device.deviceIp),
      hikDevIndex: trimOptional(device.hikDevIndex),
      hikEhomeID: trimOptional(device.ehomeID),
      ideUuid: trimOptional(device.ideUuid),
      createdAt: now,
      updatedAt: now,
    });

    return { inserted: true };
  },
});

export const recordHikDeviceEvent = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    deviceId: v.optional(v.id("devices")),
    source: v.optional(SOURCE_VALIDATOR),
    eventTime: v.string(),
    major: v.optional(v.number()),
    minor: v.optional(v.number()),
    cardNo: v.optional(v.string()),
    rawData: v.optional(v.string()),
    deviceSerial: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    hikDevIndex: v.optional(v.string()),
    hikEhomeID: v.optional(v.string()),
    hikSerialNo: v.optional(v.number()),
    hikFrontSerialNo: v.optional(v.number()),
    hikEventState: v.optional(v.string()),
    ideUuid: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ inserted: boolean; reason?: string }> => {
    let device = args.deviceId ? await ctx.db.get(args.deviceId) : null;
    if (!device && args.deviceSerial) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) => q.eq("deviceSerial", args.deviceSerial))
        .first();
    }
    if (!device && args.hikDevIndex) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_hik_dev_index", (q) => q.eq("hikDevIndex", args.hikDevIndex))
        .first();
    }
    if (!device && args.hikEhomeID) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_ehome_id", (q) => q.eq("ehomeID", args.hikEhomeID))
        .first();
    }
    if (!device && args.ideUuid) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid))
        .first();
    }
    if (!device && args.deviceIp) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_ip", (q) => q.eq("deviceIp", args.deviceIp))
        .first();
    }

    const deviceId = device?._id ?? args.deviceId;
    const projectId = args.projectId ?? device?.projectId;

    if (deviceId && args.hikSerialNo !== undefined) {
      const existing = await ctx.db
        .query("deviceEvents")
        .withIndex("by_device_and_hik_serial", (q) =>
          q.eq("deviceId", deviceId).eq("hikSerialNo", args.hikSerialNo),
        )
        .first();
      if (existing) {
        return { inserted: false, reason: "duplicate" };
      }
    }

    const event = classifyHikEvent(args.major, args.minor);
    const now = new Date().toISOString();

    await ctx.db.insert("deviceEvents", {
      projectId,
      deviceId,
      source: args.source ?? "hikvision",
      eventTime: args.eventTime,
      category: event.category,
      severity: event.severity,
      label: event.label,
      major: args.major,
      minor: args.minor,
      cardNo: trimOptional(args.cardNo),
      rawData: truncateRawData(args.rawData),
      deviceSerial: trimOptional(args.deviceSerial),
      deviceIp: trimOptional(args.deviceIp),
      hikDevIndex: trimOptional(args.hikDevIndex),
      hikEhomeID: trimOptional(args.hikEhomeID),
      hikSerialNo: args.hikSerialNo,
      hikFrontSerialNo: args.hikFrontSerialNo,
      hikEventState: trimOptional(args.hikEventState),
      ideUuid: trimOptional(args.ideUuid),
      createdAt: now,
      updatedAt: now,
    });

    return { inserted: true };
  },
});
