
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

type ReaderDirection = "entry" | "exit" | "both";

/**
 * Kapı IDE Smart panele bağlıysa (deviceId → brand ide_smart, ioId var) sensör onayı
 * ayarını panele yaz: ACTUATOR{ioId}.REQUIRE_SENSOR_ACTIVATION = requireSensor ? 1 : 0.
 * Sensörsüz kapıda 1 kalırsa actuator "busy"de takılır (docs §9.1 Step 1).
 */
async function scheduleSensorSync(
  ctx: MutationCtx,
  deviceId: Id<"devices"> | undefined,
  ioId: number | undefined,
  requireSensor: boolean,
): Promise<void> {
  if (!deviceId || typeof ioId !== "number") return;
  const device = await ctx.db.get(deviceId);
  if (!device || device.brand !== "ide_smart") return;
  const parameterName = `ACTUATOR${ioId}.REQUIRE_SENSOR_ACTIVATION`;
  await ctx.scheduler.runAfter(0, internal.ideSync.enqueueIdeOp, {
    deviceId,
    projectId: device.projectId,
    opType: "parameterWrite",
    payload: {
      parameterName,
      parameterRecord: { [parameterName]: requireSensor ? 1 : 0 },
    },
  });
}

// IDE Smart aktüatör index'ine göre okuyucu yön etiketini türetir.
// cardReadings.resolveDirection ile aynı eşleme: io 0=entry, 1=exit, diğer=both.
function directionFromIo(io: number | undefined): ReaderDirection {
  if (io === 0) return "entry";
  if (io === 1) return "exit";
  return "both";
}

// Son okuma/heartbeat bu pencere içindeyse okuyucu çevrimiçi sayılır.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export const list = authedQuery({
  args: {
    zoneId: v.optional(v.id("zones")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId);
      if (!zone) return [];
      if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
        return [];
      }
      const zoneDoors = await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
      // Defense-in-depth: zone bazlı RBAC'tan geçen kapıları ayrıca door.projectId
      // ile süz — başka tenant'ın kapısı bu zone'a (hatalı/eski pointer) işaret
      // ediyorsa sızdırma. isProjectAllowed undefined projectId'yi de eler (orphan
      // kapı gösterilmez). super_admin tüm projelere yetkili olduğundan etkilenmez.
      if (ctx.user.role === "super_admin") return zoneDoors;
      return zoneDoors.filter((d) => isProjectAllowed(allowedProjectIds, d.projectId));
    }
    if (ctx.user.role === "super_admin") return await ctx.db.query("doors").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("doors")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    deviceId: v.optional(v.id("devices")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
    ioId: v.optional(v.number()),
    requireSensor: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    // Kapı bir bölgeye bağlanıyorsa bölge aynı projede olmalı (cross-tenant pointer engeli).
    if (args.zoneId !== undefined) {
      const targetZone = await ctx.db.get(args.zoneId);
      if (!targetZone) throw new Error("Bölge bulunamadı");
      if (!isProjectAllowed(allowedProjectIds, targetZone.projectId)) {
        throw new Error("Bu bölgeye erişim yetkiniz yok");
      }
      if (targetZone.projectId !== args.projectId) {
        throw new Error("Seçilen bölge bu kapının projesinde değil");
      }
    }
    const now = new Date().toISOString();
    const doorId = await ctx.db.insert("doors", {
      ...args,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
    if (args.requireSensor !== undefined) {
      await scheduleSensorSync(ctx, args.deviceId, args.ioId, args.requireSensor);
    }
    return doorId;
  },
});

export const update = authedMutation({
  args: {
    doorId: v.id("doors"),
    name: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    deviceId: v.optional(v.id("devices")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
    ioId: v.optional(v.number()),
    requireSensor: v.optional(v.boolean()),
    readerName: v.optional(v.string()),
    readerDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new Error("Kapı bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, door.projectId)) {
      throw new Error("Bu kapıya erişim yetkiniz yok");
    }
    // args.zoneId verildiyse hedef bölgenin sahibini doğrula (cross-tenant pointer
    // engeli; readerStatus/list zone bazlı RBAC yaptığından sızıntıyı önler).
    if (args.zoneId !== undefined) {
      const targetZone = await ctx.db.get(args.zoneId);
      if (!targetZone) throw new Error("Bölge bulunamadı");
      if (!isProjectAllowed(allowedProjectIds, targetZone.projectId)) {
        throw new Error("Bu bölgeye erişim yetkiniz yok");
      }
      if (targetZone.projectId !== door.projectId) {
        throw new Error("Seçilen bölge bu kapının projesinde değil");
      }
    }
    const { doorId, ...updates } = args;
    await ctx.db.patch(doorId, { ...updates, updatedAt: new Date().toISOString() });
    // Sensör ayarı değiştiyse panele yaz (ioId güncellenmiş olabilir → yeni değer öncelikli).
    if (args.requireSensor !== undefined) {
      await scheduleSensorSync(
        ctx,
        door.deviceId,
        args.ioId ?? door.ioId,
        args.requireSensor,
      );
    }
  },
});

export const remove = authedMutation({
  args: { doorId: v.id("doors") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new Error("Kapı bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, door.projectId)) {
      throw new Error("Bu kapıya erişim yetkiniz yok");
    }
    if (door.deviceId) {
      const owner = await ctx.db.get(door.deviceId);
      if (owner?.brand === "ide_smart") {
        throw new Error(
          "Bu kapı bir IDE Smart paneline ait — kapıları paneli silerek kaldırın.",
        );
      }
    }
    await ctx.db.delete(args.doorId);
  },
});

/**
 * Her kapının "okuyucu yüzü" + canlı durumu. Kapı ağacında alt-satır olarak gösterilir.
 * IDE Smart kapıları: son okuma panel cihazı + ioId ile çözülür. Diğer markalar:
 * doorId ile bağlı cihazın son okuması. Çevrimiçi = son okuma veya panel.lastSeen pencere içinde.
 */
export const readerStatus = authedQuery({
  args: { zoneId: v.optional(v.id("zones")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    // 1) Kapsamdaki kapılar (list ile aynı erişim mantığı)
    let doors: Doc<"doors">[];
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId);
      if (!zone) return [];
      if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
        return [];
      }
      const zoneDoors = await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
      // Defense-in-depth: zone üzerinden çekilen kapıları door.projectId ile süz —
      // başka tenant'ın kapısı bu zone'a işaret ediyorsa kart okuma verisi sızmasın.
      // isProjectAllowed undefined projectId'yi de eler (list ile aynı semantik).
      doors =
        ctx.user.role === "super_admin"
          ? zoneDoors
          : zoneDoors.filter((d) => isProjectAllowed(allowedProjectIds, d.projectId));
    } else if (ctx.user.role === "super_admin") {
      doors = await ctx.db.query("doors").collect();
    } else if (allowedProjectIds.length === 0) {
      return [];
    } else {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("doors")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      doors = results.flat();
    }

    // 2) Kapının paneli (door.deviceId) → cihaz başına bir kez çöz
    const panelDeviceIds = Array.from(
      new Set(
        doors
          .map((d) => d.deviceId)
          .filter((id): id is NonNullable<typeof id> => id != null)
      )
    );
    const panelById = new Map<string, Doc<"devices"> | null>();
    await Promise.all(
      panelDeviceIds.map(async (did) => {
        panelById.set(String(did), await ctx.db.get(did));
      })
    );

    const now = Date.now();
    const within = (iso: string | null | undefined): boolean =>
      iso ? now - new Date(iso).getTime() < ONLINE_WINDOW_MS : false;

    // 3) Her kapı için okuyucu tanımı + son okuma + çevrimiçi bayrağı
    return await Promise.all(
      doors.map(async (door) => {
        const panel = door.deviceId
          ? panelById.get(String(door.deviceId)) ?? null
          : null;

        let last: Doc<"cardReadings"> | null = null;
        const io = door.ioId;
        if (panel && io !== undefined) {
          const panelId = panel._id;
          last = await ctx.db
            .query("cardReadings")
            .withIndex("by_device_io_time", (q) =>
              q.eq("deviceId", panelId).eq("ideIoId", io)
            )
            .order("desc")
            .first();
        } else {
          const dev = await ctx.db
            .query("devices")
            .filter((q) => q.eq(q.field("doorId"), door._id))
            .first();
          if (dev) {
            last = await ctx.db
              .query("cardReadings")
              .withIndex("by_device", (q) => q.eq("deviceId", dev._id))
              .order("desc")
              .first();
          }
        }

        return {
          doorId: door._id,
          readerName: door.readerName ?? door.name,
          readerDirection: door.readerDirection ?? directionFromIo(door.ioId),
          lastReadAt: last?.accessTime ?? null,
          lastCardNo: last?.cardNo ?? null,
          lastEmployeeName: last?.employeeName ?? null,
          lastStatus: last?.accessStatus ?? null,
          lastDirection: last?.direction ?? null,
          online: within(last?.accessTime) || within(panel?.lastSeen),
        };
      })
    );
  },
});

/** Action'lardan kapı (ioId dahil) çözümü için. */
export const getByIdInternal = internalQuery({
  args: { id: v.id("doors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
