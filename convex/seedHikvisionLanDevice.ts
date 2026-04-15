/**
 * LAN’daki Hikvision DS-K1T807 (192.168.1.164) cihazını devices tablosuna ekler veya seri no ile günceller.
 * Convex Dashboard → Functions → seedHikvisionLanDevice:run → Run
 * veya: npx convex run seedHikvisionLanDevice:run
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_IP = "192.168.1.34";
const DEFAULT_SERIAL = "DS-K1T807EBFWX-E120250619V042400ENGB8172365";

export const run = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    name: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    deviceSerial: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const deviceIp = args.deviceIp ?? DEFAULT_IP;
    const deviceSerial = args.deviceSerial ?? DEFAULT_SERIAL;
    const name = args.name ?? `Hikvision DS-K1T807 (${deviceIp})`;

    let projectId = args.projectId;
    if (!projectId) {
      projectId = (await ctx.db.query("projects").first())?._id;
    }
    if (!projectId) {
      projectId = await ctx.db.insert("projects", {
        name: "Varsayılan Proje",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existing = await ctx.db
      .query("devices")
      .withIndex("by_device_serial", (q) => q.eq("deviceSerial", deviceSerial))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        projectId,
        deviceType: "access_control",
        deviceIp,
        deviceSerial,
        isActive: true,
        status: "active",
        updatedAt: now,
      });
      return {
        action: "updated" as const,
        deviceId: existing._id,
        projectId,
      };
    }

    const deviceId = await ctx.db.insert("devices", {
      name,
      projectId,
      deviceType: "access_control",
      deviceIp,
      deviceSerial,
      isActive: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { action: "created" as const, deviceId, projectId };
  },
});
