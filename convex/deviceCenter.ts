import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

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

    const [doorRows, readerRows] = await Promise.all([
      ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .take(257),
      ctx.db
        .query("readers")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .take(1025),
    ]);

    const doors = doorRows.slice(0, 256);
    const readers = readerRows.slice(0, 1024);

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
        hikIsupOnline: device.hikIsupOnline,
        hikIsupStatusAt: device.hikIsupStatusAt,
        hikIsupOfflineSince: device.hikIsupOfflineSince,
        ideUuid: device.ideUuid,
      },
      doors: doors.map((door) => ({
        _id: door._id,
        name: door.name,
        ioId: door.ioId,
        hikDoorNo: door.hikDoorNo,
      })),
      readers: readers.map((reader) => ({
        _id: reader._id,
        name: reader.name,
      })),
    };
  },
});
