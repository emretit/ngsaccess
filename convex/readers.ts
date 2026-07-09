import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { getHikModelSpec } from "./lib/hikModels";
import { deriveHikReaderNoFromDoorNo } from "./lib/hikReaderNumbers";

type ReaderDirection = "entry" | "exit" | "both";

/**
 * Kapı başına izin verilen en çok okuyucu. IDE Smart panel kapısı tek okuyucu yüzlüdür
 * (tek aktüatör); Hikvision kontrolör kapısı giriş+çıkış (modelden maxReadersPerDoor);
 * markasız/manuel kapı kontrolör varsayar (2). Sunucu otoritedir — istemci cap'ine güvenmeyiz.
 */
async function maxReadersForDoor(
  ctx: QueryCtx | MutationCtx,
  door: Doc<"doors">,
): Promise<number> {
  if (!door.deviceId) return 2;
  const device = await ctx.db.get(door.deviceId);
  if (!device) return 2;
  if (device.brand === "ide_smart") return 1;
  if (device.brand === "hikvision") {
    return getHikModelSpec(device.hikModel)?.maxReadersPerDoor ?? 2;
  }
  return 2;
}

async function maxReadersForDevice(
  ctx: QueryCtx | MutationCtx,
  deviceId: Id<"devices"> | undefined,
): Promise<number | null> {
  if (!deviceId) return null;
  const device = await ctx.db.get(deviceId);
  if (!device) return null;
  if (device.brand === "hikvision") {
    const spec = getHikModelSpec(device.hikModel);
    if (spec) return spec.doorCount * spec.defaultReadersPerDoor;
    return device.hikDoorCount ?? device.doorCount ?? null;
  }
  if (device.brand === "ide_smart") {
    return device.ideDoorCount ?? device.doorCount ?? null;
  }
  return null;
}

async function countReadersForDevice(
  ctx: QueryCtx | MutationCtx,
  deviceId: Id<"devices">,
): Promise<number> {
  const rows = await ctx.db
    .query("readers")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .collect();
  return rows.length;
}

export const list = authedQuery({
  args: {
    doorId: v.optional(v.id("doors")),
    zoneId: v.optional(v.id("zones")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.doorId) {
      const door = await ctx.db.get(args.doorId);
      if (!door) return [];
      if (!isProjectAllowed(allowedProjectIds, door.projectId)) return [];
      // TypeScript narrowing: args.doorId undefined ise üsteki if bloğu buraya girmez.
      // Tip sistemi bunu takip etmediği için lokal değişkene çekiyoruz.
      const narrowedDoorId = args.doorId;
      if (!narrowedDoorId) return [];
      return await ctx.db
        .query("readers")
        .withIndex("by_door", (q) => q.eq("doorId", narrowedDoorId))
        .collect();
    }
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId);
      if (!zone) return [];
      if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
        return [];
      }
      const zoneReaders = await ctx.db
        .query("readers")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
      if (ctx.user.role === "super_admin") return zoneReaders;
      return zoneReaders.filter((r) => isProjectAllowed(allowedProjectIds, r.projectId));
    }
    if (args.projectId) {
      if (!allowedProjectIds.some((id) => id === args.projectId)) return [];
      return await ctx.db
        .query("readers")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    }
    if (ctx.user.role === "super_admin") return await ctx.db.query("readers").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("readers")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = authedMutation({
  args: {
    doorId: v.id("doors"),
    name: v.string(),
    direction: v.union(v.literal("entry"), v.literal("exit"), v.literal("both")),
    hikReaderNo: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  returns: v.id("readers"),
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new Error("Kapı bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, door.projectId)) {
      throw new Error("Bu kapıya erişim yetkiniz yok");
    }
    const existing = await ctx.db
      .query("readers")
      .withIndex("by_door", (q) => q.eq("doorId", args.doorId))
      .collect();
    const max = await maxReadersForDoor(ctx, door);
    if (existing.length >= max) {
      throw new Error(`Bu kapı en çok ${max} okuyucu taşıyabilir`);
    }
    if (door.deviceId) {
      const deviceMax = await maxReadersForDevice(ctx, door.deviceId);
      if (deviceMax !== null) {
        const deviceReaders = await countReadersForDevice(ctx, door.deviceId);
        if (deviceReaders >= deviceMax) {
          throw new Error(
            `Bu panelin fiziksel okuyucu kapasitesi dolu (${deviceMax}). Yeni okuyucu eklemek yerine mevcut okuyucuyu taşıyın.`,
          );
        }
      }
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("readers", {
      doorId: args.doorId,
      deviceId: door.deviceId,
      projectId: door.projectId,
      zoneId: door.zoneId,
      name: args.name.trim() || door.name,
      direction: args.direction,
      hikReaderNo:
        args.hikReaderNo ??
        deriveHikReaderNoFromDoorNo(door.hikDoorNo ?? undefined, args.direction),
      ioId: door.ioId,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const move = authedMutation({
  args: {
    readerId: v.id("readers"),
    targetDoorId: v.id("doors"),
    direction: v.union(v.literal("entry"), v.literal("exit"), v.literal("both")),
  },
  handler: async (ctx, args): Promise<void> => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const reader = await ctx.db.get(args.readerId);
    if (!reader) throw new Error("Okuyucu bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, reader.projectId)) {
      throw new Error("Bu okuyucuya erişim yetkiniz yok");
    }

    const sourceDoor = await ctx.db.get(reader.doorId);
    const targetDoor = await ctx.db.get(args.targetDoorId);
    if (!sourceDoor || !targetDoor) throw new Error("Kapı bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, targetDoor.projectId)) {
      throw new Error("Hedef kapıya erişim yetkiniz yok");
    }
    if (reader.deviceId !== targetDoor.deviceId) {
      throw new Error("Okuyucu yalnızca aynı panelin kapıları arasında taşınabilir");
    }

    if (reader.doorId !== args.targetDoorId) {
      const targetReaders = await ctx.db
        .query("readers")
        .withIndex("by_door", (q) => q.eq("doorId", args.targetDoorId))
        .collect();
      const max = await maxReadersForDoor(ctx, targetDoor);
      if (targetReaders.length >= max) {
        throw new Error(`Hedef kapı en çok ${max} okuyucu taşıyabilir`);
      }
    }

    await ctx.db.patch(args.readerId, {
      doorId: args.targetDoorId,
      deviceId: targetDoor.deviceId,
      projectId: targetDoor.projectId,
      zoneId: targetDoor.zoneId,
      direction: args.direction,
      ioId: targetDoor.ioId,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const update = authedMutation({
  args: {
    readerId: v.id("readers"),
    name: v.optional(v.string()),
    direction: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    hikReaderNo: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const reader = await ctx.db.get(args.readerId);
    if (!reader) throw new Error("Okuyucu bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, reader.projectId)) {
      throw new Error("Bu okuyucuya erişim yetkiniz yok");
    }
    const { readerId, ...updates } = args;
    await ctx.db.patch(readerId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { readerId: v.id("readers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.readerId);
  },
});

export const setHikReaderSnapshot = internalMutation({
  args: {
    readerId: v.id("readers"),
    snapshot: v.string(),
    updatedAt: v.number(),
    hikVerifyMode: v.optional(v.string()),
    hikCardReaderName: v.optional(v.string()),
    hikCardReaderPlanTemplateNo: v.optional(v.number()),
    hikCardReaderAntiSneakEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.readerId, {
      hikLastCfgSnapshot: args.snapshot,
      hikLastCfgAt: args.updatedAt,
      hikVerifyMode: args.hikVerifyMode,
      hikCardReaderName: args.hikCardReaderName,
      hikCardReaderPlanTemplateNo: args.hikCardReaderPlanTemplateNo,
      hikCardReaderAntiSneakEnabled: args.hikCardReaderAntiSneakEnabled,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const remove = authedMutation({
  args: { readerId: v.id("readers") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const reader = await ctx.db.get(args.readerId);
    if (!reader) throw new Error("Okuyucu bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, reader.projectId)) {
      throw new Error("Bu okuyucuya erişim yetkiniz yok");
    }
    await ctx.db.delete(args.readerId);
  },
});

/**
 * IDE Smart aktüatör index'ine göre yön türetimi (doors.ts directionFromIo ile aynı):
 * io 0=entry, 1=exit, diğer=both. Legacy kapılardan okuyucu üretirken kullanılır.
 */
function directionFromIo(io: number | undefined): ReaderDirection {
  if (io === 0) return "entry";
  if (io === 1) return "exit";
  return "both";
}

/**
 * Geriye uyum migrasyonu: okuyucu satırı olmayan her kapı için legacy alanlardan
 * (readerName/readerDirection/ioId/hikDoorNo) tek okuyucu üretir. Idempotent —
 * zaten okuyucusu olan kapı atlanır. Sayfalı; deploy sonrası `npx convex run` ile çağrılır.
 */
export const backfillReadersFromDoors = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
  },
  returns: v.object({
    isDone: v.boolean(),
    cursor: v.union(v.string(), v.null()),
    created: v.number(),
    scanned: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("doors").paginate({
      cursor: args.cursor ?? null,
      numItems: args.numItems ?? 100,
    });
    let created = 0;
    for (const door of result.page) {
      const existing = await ctx.db
        .query("readers")
        .withIndex("by_door", (q) => q.eq("doorId", door._id))
        .first();
      if (existing) continue;
      const direction = door.readerDirection ?? directionFromIo(door.ioId);
      const now = new Date().toISOString();
      await ctx.db.insert("readers", {
        doorId: door._id,
        deviceId: door.deviceId,
        projectId: door.projectId,
        zoneId: door.zoneId,
        name: door.readerName ?? door.name,
        direction,
        hikReaderNo: deriveHikReaderNoFromDoorNo(door.hikDoorNo ?? undefined, direction),
        ioId: door.ioId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
    return {
      isDone: result.isDone,
      cursor: result.continueCursor,
      created,
      scanned: result.page.length,
    };
  },
});

/** Bir kapının okuyucularını siler (cascade). doors.remove / purgeDeviceCascade çağırır. */
export async function deleteReadersForDoor(
  ctx: MutationCtx,
  doorId: Id<"doors">,
): Promise<void> {
  const readers = await ctx.db
    .query("readers")
    .withIndex("by_door", (q) => q.eq("doorId", doorId))
    .collect();
  await Promise.all(readers.map((r) => ctx.db.delete(r._id)));
}
