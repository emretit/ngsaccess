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

type HikQueueStatus = "pending" | "processing" | "done" | "failed";
type IdeQueueStatus = "pending" | "sent" | "acked" | "failed";

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
      supported: probes.filter((p) => p.supported === true).length,
      unsupported: probes.filter((p) => p.supported === false).length,
      unknown: probes.filter((p) => p.ok && p.supported === null).length,
      failed: probes.filter((p) => !p.ok).length,
      probes,
    };
  } catch {
    return null;
  }
}

function isRecentIso(value: string | undefined, windowMs: number, now: number): boolean {
  if (!value) return false;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && now - parsed <= windowMs;
}

function isRecentEpoch(value: number | undefined, windowMs: number, now: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && now - value <= windowMs;
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

    const [doors, readers, recentEvents] = await Promise.all([
      ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect(),
      ctx.db
        .query("readers")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect(),
      ctx.db
        .query("deviceEvents")
        .withIndex("by_device_and_event_time", (q) => q.eq("deviceId", args.deviceId))
        .order("desc")
        .take(10),
    ]);

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

    const hikStatuses: HikQueueStatus[] = ["pending", "processing", "done", "failed"];
    const hikQueuePairs = await Promise.all(
      hikStatuses.map(async (status) => {
        const rows = await ctx.db
          .query("hikPendingOperations")
          .withIndex("by_device_status", (q) => q.eq("deviceId", args.deviceId).eq("status", status))
          .collect();
        return [status, rows] as const;
      }),
    );

    const ideStatuses: IdeQueueStatus[] = ["pending", "sent", "acked", "failed"];
    const ideQueuePairs = await Promise.all(
      ideStatuses.map(async (status) => {
        const rows = await ctx.db
          .query("idePendingOperations")
          .withIndex("by_device_status", (q) => q.eq("deviceId", args.deviceId).eq("status", status))
          .collect();
        return [status, rows] as const;
      }),
    );
    const hikRowsByStatus = new Map(hikQueuePairs);
    const ideRowsByStatus = new Map(ideQueuePairs);
    const summarizeHikQueue = (status: HikQueueStatus) => {
      const rows = hikRowsByStatus.get(status) ?? [];
      return {
        count: rows.length,
        latest: rows
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3)
          .map((row) => ({
            _id: row._id,
            operation: row.operation,
            attemptCount: row.attemptCount,
            lastError: row.lastError,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
          })),
      };
    };
    const summarizeIdeQueue = (status: IdeQueueStatus) => {
      const rows = ideRowsByStatus.get(status) ?? [];
      return {
        count: rows.length,
        latest: rows
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3)
          .map((row) => ({
            _id: row._id,
            opType: row.opType,
            attempts: row.attempts,
            lastError: row.lastError,
            responseMessage: row.responseMessage,
            createdAt: row.createdAt,
            ackedAt: row.ackedAt,
          })),
      };
    };

    const now = Date.now();
    const onlineWindowMs = 5 * 60 * 1000;
    const isHikOnline =
      device.hikTransport === "localBridge"
        ? isRecentIso(device.lastSeen, onlineWindowMs, now)
        : isRecentEpoch(device.hikLastSeenAt, onlineWindowMs, now);
    const isIdeOnline = isRecentIso(device.lastSeen, onlineWindowMs, now);

    return {
      device: {
        _id: device._id,
        name: device.name,
        brand: device.brand ?? "other",
        projectId: device.projectId,
        status: device.status,
        isActive: device.isActive,
        deviceIp: device.deviceIp,
        deviceSerial: device.deviceSerial,
        lastSeen: device.lastSeen,
        doorCount: device.doorCount,
        hikTransport: device.hikTransport,
        hikDevIndex: device.hikDevIndex,
        ehomeID: device.ehomeID,
        hikModel: device.hikModel,
        hikLastSeenAt: device.hikLastSeenAt,
        hikOfflineHint: device.hikOfflineHint,
        hikDoorCount: device.hikDoorCount,
        hikCapabilitiesUpdatedAt: device.hikCapabilitiesUpdatedAt,
        hikWorkStatus: device.hikWorkStatus,
        ideUuid: device.ideUuid,
        ideDoorCount: device.ideDoorCount,
        ideHttpPort: device.ideHttpPort,
      },
      online: {
        isOnline:
          device.brand === "hikvision"
            ? isHikOnline
            : device.brand === "ide_smart"
              ? isIdeOnline
              : isRecentIso(device.lastSeen, onlineWindowMs, now),
        checkedAt: now,
        windowMs: onlineWindowMs,
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
          hikDoorStatusPlan: door.hikDoorStatusPlan,
          hikVerifyPlan: door.hikVerifyPlan,
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
        hikVerifyMode: reader.hikVerifyMode,
        hikCardReaderName: reader.hikCardReaderName,
        hikCardReaderPlanTemplateNo: reader.hikCardReaderPlanTemplateNo,
        hikCardReaderAntiSneakEnabled: reader.hikCardReaderAntiSneakEnabled,
        hikLastCfgAt: reader.hikLastCfgAt,
      })),
      recentEvents,
      capabilities: parseHikCapabilitySummary(device.hikCapabilitiesSnapshot),
      queues: {
        hikvision: {
          pending: summarizeHikQueue("pending"),
          processing: summarizeHikQueue("processing"),
          done: summarizeHikQueue("done"),
          failed: summarizeHikQueue("failed"),
        },
        ideSmart: {
          pending: summarizeIdeQueue("pending"),
          sent: summarizeIdeQueue("sent"),
          acked: summarizeIdeQueue("acked"),
          failed: summarizeIdeQueue("failed"),
        },
      },
    };
  },
});
