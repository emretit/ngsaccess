import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import { adminDeviceRow, adminPaginationOptions, adminSearch } from "./lib/adminLists";
import { deviceConnection } from "./lib/deviceConnection";
import { deviceIdentityError } from "./lib/deviceIdentity";
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
    const identityError = deviceIdentityError(ideUuid, args.brand);
    if (identityError) throw new Error(identityError);

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

/** Inventory search with the existing five-minute connection policy. */
export const adminListPage = superAdminQuery({
  args: {
    search: v.optional(v.string()),
    assignment: v.optional(v.union(v.literal("pool"), v.literal("assigned"), v.id("projects"))),
    connection: v.optional(v.union(v.literal("online"), v.literal("offline"), v.literal("never"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Assigned inventory rows get the live signal fields from their project device.
    const signals = new Map<Id<"devices">, Promise<Doc<"devices"> | null>>();
    const signalFor = async (device: Doc<"adminDevices">) => {
      if (!device.assignedDeviceId) return device;
      let signal = signals.get(device.assignedDeviceId);
      if (!signal) { signal = ctx.db.get(device.assignedDeviceId); signals.set(device.assignedDeviceId, signal); }
      const assigned = await signal;
      return assigned?.brand === "hikvision" && assigned.hikTransport !== "localBridge" ? assigned : device;
    };
    const projects = new Map<Id<"projects">, Promise<Doc<"projects"> | null>>();
    const projectFor = (id: Id<"projects"> | undefined) => {
      if (!id) return Promise.resolve(null);
      let project = projects.get(id);
      if (!project) { project = ctx.db.get(id); projects.set(id, project); }
      return project;
    };
    let totalScanned = 0;
    const result = await stream(ctx.db, schema).query("adminDevices").order("desc").filterWith(async device => {
      totalScanned++;
      if (args.assignment === "pool" && device.assignedDeviceId) return false;
      if (args.assignment === "assigned" && !device.assignedDeviceId) return false;
      if (args.assignment && args.assignment !== "pool" && args.assignment !== "assigned" && device.assignedProjectId !== args.assignment) return false;
      if (args.connection && deviceConnection(await signalFor(device), now) !== args.connection) return false;
      if (!args.search?.trim()) return true;
      const project = await projectFor(device.assignedProjectId);
      return adminSearch(args.search, device.name, device.ideUuid, device.deviceSerial, device.brand, project?.name);
    }).paginate(adminPaginationOptions(args.paginationOpts));
    return { ...result, filterScope: "server" as const, totalScanned, evaluatedAt: now,
      page: await Promise.all(result.page.map(async device => {
        const signal = await signalFor(device);
        return {
          ...adminDeviceRow(device, (await projectFor(device.assignedProjectId))?.name ?? null),
          lastSeen: signal.lastSeen,
          ...("hikTransport" in signal ? { hikTransport: signal.hikTransport } : {}),
          ...("hikLastSeenAt" in signal ? { hikLastSeenAt: signal.hikLastSeenAt } : {}),
          ...("hikOfflineHint" in signal ? { hikOfflineHint: signal.hikOfflineHint } : {}),
          ...("hikIsupOnline" in signal ? { hikIsupOnline: signal.hikIsupOnline } : {}),
          ...("hikIsupStatusAt" in signal ? { hikIsupStatusAt: signal.hikIsupStatusAt } : {}),
          ...("hikIsupOfflineSince" in signal ? { hikIsupOfflineSince: signal.hikIsupOfflineSince } : {}),
          connectionStatus: deviceConnection(signal, now),
        };
      })),
    };
  },
});
