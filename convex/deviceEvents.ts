import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { deviceConnection, deviceLastSignal, hasPeriodicHeartbeat, hasFreshIsupStatus, DEVICE_ONLINE_WINDOW_MS } from "./lib/deviceConnection";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { classifyHikEvent } from "./lib/hikEventCatalog";
import { toUtcISO } from "./lib/trDate";
import { notifyAlarmIfNeeded } from "./lib/alarmNotify";

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

export const recordOperationInternal = internalMutation({
  args: {
    deviceId: v.id("devices"),
    label: v.string(),
    ok: v.boolean(),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ inserted: boolean }> => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Cihaz bulunamadı");
    }

    const now = new Date().toISOString();
    const eventId = await ctx.db.insert("deviceEvents", {
      projectId: device.projectId,
      deviceId: args.deviceId,
      source: "system",
      eventTime: now,
      category: "operation",
      severity: args.ok ? "info" : "warning",
      label: trimOptional(args.label) ?? "Cihaz operasyonu",
      rawData: trimOptional(args.summary)?.slice(0, 2000),
      deviceSerial: trimOptional(device.deviceSerial),
      deviceIp: trimOptional(device.deviceIp),
      hikDevIndex: trimOptional(device.hikDevIndex),
      hikEhomeID: trimOptional(device.ehomeID),
      ideUuid: trimOptional(device.ideUuid),
      createdAt: now,
      updatedAt: now,
    });
    await notifyAlarmIfNeeded(ctx, eventId);

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

    const eventId = await ctx.db.insert("deviceEvents", {
      projectId,
      deviceId,
      source: args.source ?? "hikvision",
      eventTime: toUtcISO(args.eventTime) ?? now,
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

    await notifyAlarmIfNeeded(ctx, eventId);

    return { inserted: true };
  },
});


type ConnectivityPeriod = { offlineFrom: number; offlineTo: number; durationMs: number };

function parseConnectivityPeriod(rawData: string | undefined): ConnectivityPeriod | undefined {
  if (!rawData) return;
  try {
    const value: unknown = JSON.parse(rawData);
    if (typeof value !== "object" || value === null ||
      !("offlineFrom" in value) || !("offlineTo" in value) || !("durationMs" in value)) return;
    const { offlineFrom, offlineTo, durationMs } = value;
    if (typeof offlineFrom !== "number" || typeof offlineTo !== "number" || typeof durationMs !== "number" ||
      !Number.isFinite(offlineFrom) || !Number.isFinite(offlineTo) || !Number.isFinite(durationMs) ||
      offlineTo <= offlineFrom || durationMs !== offlineTo - offlineFrom) return;
    return { offlineFrom, offlineTo, durationMs };
  } catch { return; }
}

export const getConnectivityHistory = authedQuery({
  args: { deviceId: v.id("devices"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    const allowed = await getProjectIdsForUser(ctx);
    if (!isProjectAllowed(allowed, device.projectId)) throw new Error("Bu cihaza erişim yetkiniz yok");
    const days = args.days ?? 30;
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("Gün sayısı 1–30 arasında olmalı");
    const now = Date.now();
    const cutoff = now - days * 86400000;
    // Category + label in the index keep other events (access/alarm/other status) out of the scan and the subscription.
    const rows = await ctx.db.query("deviceEvents")
      .withIndex("by_device_category_label_event_time", q => q.eq("deviceId", args.deviceId).eq("category", "status").eq("label", "Çevrimdışı dönemi").gte("eventTime", new Date(cutoff).toISOString()))
      .order("desc")
      .take(501);
    const periods: ConnectivityPeriod[] = [];
    for (const row of rows.slice(0, 500)) {
      const period = parseConnectivityPeriod(row.rawData);
      if (period && period.offlineTo <= now && period.offlineTo >= cutoff) {
        periods.push(period);
      }
    }
    const signal = deviceLastSignal(device, now);
    const periodicHeartbeat = hasPeriodicHeartbeat(device, now);
    const confirmedIsup = !hasFreshIsupStatus(device, now) || (signal !== undefined && now - signal >= DEVICE_ONLINE_WINDOW_MS);
    const ongoing = confirmedIsup && (periodicHeartbeat || device.hikOfflineHint) && deviceConnection(device, now) === "offline" && signal !== undefined && signal < now
      ? { since: signal } : undefined;
    const ongoingMs = ongoing ? now - Math.max(cutoff, ongoing.since) : 0;
    return {
      asOf: now,
      count: periods.length + (ongoing ? 1 : 0),
      totalMs: periods.reduce((sum, p) => sum + p.offlineTo - Math.max(cutoff, p.offlineFrom), ongoingMs),
      longestMs: periods.reduce((longest, p) => Math.max(longest, p.offlineTo - Math.max(cutoff, p.offlineFrom)), ongoingMs),
      periods: periods.slice(0, 20), ...(ongoing ? { ongoing } : {}), truncated: rows.length > 500, periodicHeartbeat,
    };
  },
});
