import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

type HikProbeSummary = {
  key: string;
  label: string;
  endpoint: string;
  ok: boolean;
  supported: boolean | null;
  error?: string;
};

type HikCapabilitySummary = {
  updatedAt: number;
  supported: number;
  unsupported: number;
  unknown: number;
  failed: number;
  probes: HikProbeSummary[];
};

type HikQueueStatus = "pending" | "processing" | "failed";
type IdeQueueStatus = "pending" | "sent" | "failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHikCapabilitySummary(raw: string | undefined): HikCapabilitySummary | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.updatedAt !== "number") {
      return null;
    }
    if (!Array.isArray(parsed.probes)) return null;

    const probes: HikProbeSummary[] = [];
    for (const item of parsed.probes) {
      if (!isRecord(item)) continue;
      if (
        typeof item.key !== "string" ||
        typeof item.label !== "string" ||
        typeof item.endpoint !== "string" ||
        typeof item.ok !== "boolean"
      ) {
        continue;
      }
      probes.push({
        key: item.key,
        label: item.label,
        endpoint: item.endpoint,
        ok: item.ok,
        supported:
          typeof item.supported === "boolean" || item.supported === null
            ? item.supported
            : null,
        error: typeof item.error === "string" ? item.error : undefined,
      });
    }

    return {
      updatedAt: parsed.updatedAt,
      supported: probes.filter((p) => p.ok && p.supported === true).length,
      unsupported: probes.filter((p) => p.ok && p.supported === false).length,
      unknown: probes.filter((p) => p.ok && p.supported === null).length,
      failed: probes.filter((p) => !p.ok).length,
      probes,
    };
  } catch {
    return null;
  }
}

export const getOverview = authedQuery({
  args: {
    deviceId: v.id("devices"),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;

    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      return null;
    }

    const [doorRows, readerRows, recentEvents] = await Promise.all([
      ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .take(257),
      ctx.db
        .query("readers")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .take(1025),
      ctx.db
        .query("deviceEvents")
        .withIndex("by_device_and_event_time", (q) => q.eq("deviceId", args.deviceId))
        .order("desc")
        .take(10),
    ]);

    const doors = doorRows.slice(0, 256);
    const readers = readerRows.slice(0, 1024);

    const latestReadings = await Promise.all(
      doors.map(async (door) => {
        if (typeof door.ioId !== "number") {
          return { doorId: door._id, reading: null };
        }
        const reading = await ctx.db
          .query("cardReadings")
          .withIndex("by_device_io_time", (q) =>
            q.eq("deviceId", args.deviceId).eq("ideIoId", door.ioId),
          )
          .order("desc")
          .first();
        return { doorId: door._id, reading };
      }),
    );
    const readingByDoorId = new Map(latestReadings.map((item) => [item.doorId, item.reading]));

    const hikStatuses: HikQueueStatus[] = ["pending", "processing", "failed"];
    const ideStatuses: IdeQueueStatus[] = ["pending", "sent", "failed"];
    const hikQueuePairs = await Promise.all(hikStatuses.map(async (status) => {
      const rows = device.brand === "hikvision" ? await ctx.db
        .query("hikPendingOperations")
        .withIndex("by_device_status", (q) => q.eq("deviceId", args.deviceId).eq("status", status))
        .take(101) : [];
      return [status, { count: Math.min(rows.length, 100), capped: rows.length > 100 }] as const;
    }));
    const ideQueuePairs = await Promise.all(ideStatuses.map(async (status) => {
      const rows = device.brand === "ide_smart" ? await ctx.db
        .query("idePendingOperations")
        .withIndex("by_device_status", (q) => q.eq("deviceId", args.deviceId).eq("status", status))
        .take(101) : [];
      return [status, { count: Math.min(rows.length, 100), capped: rows.length > 100 }] as const;
    }));
    const hikQueue = Object.fromEntries(hikQueuePairs);
    const ideQueue = Object.fromEntries(ideQueuePairs);

    return {
      limits: { doorsCapped: doorRows.length > 256, readersCapped: readerRows.length > 1024 },
      device: {
        _id: device._id,
        name: device.name,
        brand: device.brand ?? "other",
        deviceIp: device.deviceIp,
        deviceSerial: device.deviceSerial,
        lastSeen: device.lastSeen,
        hikTransport: device.hikTransport,
        hikDevIndex: device.hikDevIndex,
        hikModel: device.hikModel,
        hikLastSeenAt: device.hikLastSeenAt,
        hikOfflineHint: device.hikOfflineHint,
        ideUuid: device.ideUuid,
      },
      doors: doors.map((door) => {
        const reading = readingByDoorId.get(door._id) ?? null;
        return {
          _id: door._id,
          name: door.name,
          status: door.status,
          ioId: door.ioId,
          requireSensor: door.requireSensor,
          readerName: door.readerName,
          readerDirection: door.readerDirection,
          hikDoorNo: door.hikDoorNo,
          latestReading: reading
            ? {
                _id: reading._id,
                cardNo: reading.cardNo,
                employeeName: reading.employeeName,
                accessTime: reading.accessTime,
                accessStatus: reading.accessStatus,
                direction: reading.direction,
              }
            : null,
        };
      }),
      readers: readers.map((reader) => ({
        _id: reader._id,
        doorId: reader.doorId,
        name: reader.name,
        direction: reader.direction,
        status: reader.status,
        ioId: reader.ioId,
        hikReaderNo: reader.hikReaderNo,
        hikCardReaderName: reader.hikCardReaderName,
        hikCardReaderPlanTemplateNo: reader.hikCardReaderPlanTemplateNo,
        hikCardReaderAntiSneakEnabled: reader.hikCardReaderAntiSneakEnabled,
      })),
      recentEvents: recentEvents.map(({ _id, label, eventTime, cardNo, category, severity }) => ({
        _id, label, eventTime, cardNo, category, severity,
      })),
      capabilities: parseHikCapabilitySummary(device.hikCapabilitiesSnapshot),
      queues: {
        hikvision: {
          pending: hikQueue.pending,
          processing: hikQueue.processing,
          failed: hikQueue.failed,
        },
        ideSmart: {
          pending: ideQueue.pending,
          sent: ideQueue.sent,
          failed: ideQueue.failed,
        },
      },
    };
  },
});
