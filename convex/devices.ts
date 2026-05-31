import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  authedQuery,
  authedMutation,
  adminMutation,
  adminQuery,
  superAdminMutation,
  employeeAuthedQuery,
} from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let devices;
    if (ctx.user.role === "super_admin") {
      devices = await ctx.db.query("devices").collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
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

/**
 * Mobile: Çalışanın erişim yetkisi olan aktif cihazları döner.
 * Akış: groupMembers (employee → group) → groupDevices (group → device) → devices.
 * Sadece `isActive !== false` cihazlar listelenir.
 */
export const listForEmployee = employeeAuthedQuery({
  args: {},
  handler: async (ctx) => {
    const employee = ctx.employee;

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
      )
      .collect();

    if (memberships.length === 0) return [];

    const groupIds = Array.from(new Set(memberships.map((m) => m.groupId)));

    // Sadece aktif erişim kuralları
    const groups = (
      await Promise.all(groupIds.map((gid) => ctx.db.get(gid)))
    ).filter((g): g is NonNullable<typeof g> => g !== null && g.isActive !== false);

    const activeGroupIds = new Set(groups.map((g) => g._id));

    const groupDeviceLinks = await Promise.all(
      Array.from(activeGroupIds).map((gid) =>
        ctx.db
          .query("groupDevices")
          .withIndex("by_project_group", (q) =>
            q.eq("projectId", employee.projectId).eq("groupId", gid),
          )
          .collect()
      )
    );

    const deviceIds = Array.from(
      new Set(groupDeviceLinks.flat().map((link) => link.deviceId))
    );

    if (deviceIds.length === 0) return [];

    const devices = (await Promise.all(deviceIds.map((id) => ctx.db.get(id))))
      .filter((d): d is NonNullable<typeof d> => d !== null && d.isActive !== false);

    return await Promise.all(
      devices.map(async (device) => {
        const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
        const door = device.doorId ? await ctx.db.get(device.doorId) : null;
        return {
          _id: device._id,
          name: device.name,
          deviceSerial: device.deviceSerial ?? null,
          deviceType: device.deviceType ?? null,
          zoneName: zone?.name ?? null,
          doorName: door?.name ?? null,
        };
      })
    );
  },
});

export const getById = authedQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }
    const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
    const door = device.doorId ? await ctx.db.get(device.doorId) : null;
    return { ...device, zone, door };
  },
});

export const create = authedMutation({
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
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    brand: v.optional(
      v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))
    ),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.string()),
    ideUuid: v.optional(v.string()),
    ideUser: v.optional(v.string()),
    idePassword: v.optional(v.string()),
    ideHttpPort: v.optional(v.number()),
    ideDoorCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
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

export const update = authedMutation({
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
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    brand: v.optional(
      v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))
    ),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.string()),
    ideUuid: v.optional(v.string()),
    ideUser: v.optional(v.string()),
    idePassword: v.optional(v.string()),
    ideHttpPort: v.optional(v.number()),
    ideDoorCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    // super_admin tüm cihazları (havuzdaki atanmamış = projectId undefined dahil) düzenleyebilir;
    // isProjectAllowed undefined'ı reddettiği için bypass gerekir (list/regenerateApiToken ile tutarlı).
    if (ctx.user.role !== "super_admin" && !isProjectAllowed(allowedProjectIds, device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }

    // args.zoneId/doorId verildiyse hedefin sahibini doğrula. Cihaz RBAC'ı yalnız
    // device.projectId'yi denetler; doğrulamadan patch'lersek başka tenant'ın zone/door
    // id'si cihaza (ve aşağıda kapılara) yazılır → cross-tenant pointer + readerStatus
    // (zone bazlı RBAC) üzerinden kart okuma sızıntısı. createIdePanel ile aynı kontrol.
    if (args.zoneId !== undefined) {
      const targetZone = await ctx.db.get(args.zoneId);
      if (!targetZone) throw new Error("Bölge bulunamadı");
      if (!isProjectAllowed(allowedProjectIds, targetZone.projectId)) {
        throw new Error("Bu bölgeye erişim yetkiniz yok");
      }
      if (targetZone.projectId !== device.projectId) {
        throw new Error("Seçilen bölge bu cihazın projesinde değil");
      }
    }
    if (args.doorId !== undefined) {
      const targetDoor = await ctx.db.get(args.doorId);
      if (!targetDoor) throw new Error("Kapı bulunamadı");
      if (!isProjectAllowed(allowedProjectIds, targetDoor.projectId)) {
        throw new Error("Bu kapıya erişim yetkiniz yok");
      }
      if (targetDoor.projectId !== device.projectId) {
        throw new Error("Seçilen kapı bu cihazın projesinde değil");
      }
    }

    const { deviceId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(deviceId, clean);

    // Panel başka bölgeye taşınırsa (zoneId değişti), o panele bağlı tüm kapıların
    // door.zoneId'sini eşitle (Variant 1 değişmezi: panelin tüm kapıları tek bölgede).
    if (args.zoneId !== undefined && args.zoneId !== device.zoneId) {
      const panelDoors = await ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
        .collect();
      await Promise.all(
        panelDoors.map((door) =>
          ctx.db.patch(door._id, { zoneId: args.zoneId, updatedAt: new Date().toISOString() })
        )
      );
    }
    return deviceId;
  },
});

export const remove = authedMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    // super_admin havuzdaki atanmamış cihazı (projectId undefined) da silebilir;
    // isProjectAllowed undefined'ı reddettiği için bypass gerekir (update ile tutarlı).
    if (ctx.user.role !== "super_admin" && !isProjectAllowed(allowedProjectIds, device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }
    // İlişkili card readings sayısını kontrol et
    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    await Promise.all(readings.map((r) => ctx.db.delete(r._id)));

    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", args.deviceId),
      )
      .collect();
    await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));

    // Cihaza/panele bağlı kapıları temizle (door.deviceId). Bölge SİLİNMEZ —
    // artık paylaşılan mantıksal alan; başka cihaz/kapı barındırabilir.
    const ownedDoors = await ctx.db
      .query("doors")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    await Promise.all(ownedDoors.map((d) => ctx.db.delete(d._id)));

    await ctx.db.delete(args.deviceId);
  },
});

/** HTTP action'dan çağrılır — cihazdan herhangi bir POST gelince lastSeen günceller. */
export const updateLastSeen = internalMutation({
  args: {
    deviceSerial: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    hikDevIndex: v.optional(v.string()),
    ehomeID: v.optional(v.string()),
    ideUuid: v.optional(v.string()),
  },
  handler: async (ctx, { deviceSerial, deviceIp, hikDevIndex, ehomeID, ideUuid }) => {
    const now = new Date().toISOString();
    let device = null;

    if (deviceSerial) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) => q.eq("deviceSerial", deviceSerial))
        .first();
    }
    if (!device && ideUuid) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
        .first();
    }
    if (!device && hikDevIndex) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_hik_dev_index", (q) => q.eq("hikDevIndex", hikDevIndex))
        .first();
    }
    if (!device && ehomeID) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_ehome_id", (q) => q.eq("ehomeID", ehomeID))
        .first();
    }
    if (!device && deviceIp) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_ip", (q) => q.eq("deviceIp", deviceIp))
        .first();
    }
    if (device) {
      // Sadece heartbeat/timestamp güncelle. deviceIp/hikDevIndex auto-populate
      // ETMİYORUZ — /card-reader unauth olduğu için saldırgan forged ipAddress
      // veya devIndex yollayarak cihaz lookup index'lerini bozabilir. Bu alanlar
      // sadece trusted yoldan (gateway register / refreshGatewayDeviceStatus) yazılır.
      await ctx.db.patch(device._id, {
        lastSeen: now,
        hikLastSeenAt: Date.now(),
      });
    }
  },
});

// ────────────────────────────────────────────────────────────
// API token — /card-reader HTTP endpoint per-device auth
// ────────────────────────────────────────────────────────────

export const regenerateApiToken = adminMutation({
  args: { deviceId: v.id("devices") },
  returns: v.object({ token: v.string(), createdAt: v.string() }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    if (ctx.user.role !== "super_admin") {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (
        !device.projectId ||
        !allowedProjectIds.some((id) => id === device.projectId)
      ) {
        throw new Error("Bu cihaza erişim yetkiniz yok");
      }
    }
    const token = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await ctx.db.patch(args.deviceId, {
      apiToken: token,
      apiTokenCreatedAt: createdAt,
      updatedAt: createdAt,
    });
    return { token, createdAt };
  },
});

export const getByApiToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_api_token", (q) => q.eq("apiToken", args.token))
      .first();
  },
});

// ────────────────────────────────────────────────────────────
// IDE Smart panel — bölge + cihaz + kapılar tek akışta
// ────────────────────────────────────────────────────────────

/** Event lookup: panel UUID → device. */
export const getByIdeUuid = internalQuery({
  args: { ideUuid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid))
      .first();
  },
});

/** setIdeUuid: panelden okunan gerçek UUID'i yazar (event lookup için). */
export const setIdeUuid = internalMutation({
  args: { deviceId: v.id("devices"), ideUuid: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      ideUuid: args.ideUuid,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Başarılı login/komut sonrası paneli online işaretle. */
export const markIdeOnline = internalMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await ctx.db.patch(args.deviceId, {
      lastSeen: now,
      status: "active",
      updatedAt: now,
    });
  },
});

/** io_id (aktüatör index) → o panele bağlı door (doors.deviceId + ioId). */
export const getPanelDoorByIo = internalQuery({
  args: { deviceId: v.id("devices"), ioId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("doors")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("ioId"), args.ioId))
      .first();
  },
});

/** IDE Smart kapı varsayılan adı: tüm aktüatörler "Kapı N" (1-indeksli). */
function defaultDoorName(io: number): string {
  return `Kapı ${io + 1}`;
}

/**
 * Bir panele bölge (zone) + N kapı (door) üretir/bağlar. createIdePanel ve claimDevice
 * ortak kullanır — cross-tenant pointer kontrolleri (zone.projectId eşleşmesi) tek yerde.
 *
 * Bölge: `zoneId` verilirse mevcut bölgeye yerleştirilir (proje doğrulanır); verilmezse
 * `newZoneName` ile yeni bölge oluşturulur (boşsa panel adından türetilir — geriye uyum).
 * Kapılar `deviceId` ile panele, `zoneId` ile bölgeye bağlanır (Variant 1: panelin tüm
 * kapıları tek bölgede). Cihaz satırının `zoneId`'sini PATCH'lemez — onu çağıran yapar.
 */
async function provisionPanelZoneAndDoors(
  ctx: MutationCtx,
  opts: {
    deviceId: Id<"devices">;
    projectId?: Id<"projects">;
    allowedProjectIds: Id<"projects">[];
    zoneId?: Id<"zones">;
    newZoneName?: string;
    panelName: string;
    description?: string;
    doorCount: number;
    now: string;
  },
): Promise<{ zoneId: Id<"zones">; doorIds: Id<"doors">[] }> {
  let zoneId: Id<"zones">;
  if (opts.zoneId) {
    const zone = await ctx.db.get(opts.zoneId);
    if (!zone) throw new Error("Bölge bulunamadı");
    if (!isProjectAllowed(opts.allowedProjectIds, zone.projectId)) {
      throw new Error("Bu bölgeye erişim yetkiniz yok");
    }
    // Bölge ile panel aynı projede olmalı — aksi halde cross-project orphan oluşur.
    if (zone.projectId !== opts.projectId) {
      throw new Error("Seçilen bölge bu panelin projesinde değil");
    }
    zoneId = opts.zoneId;
  } else {
    zoneId = await ctx.db.insert("zones", {
      name: opts.newZoneName?.trim() || opts.panelName,
      projectId: opts.projectId,
      description: opts.description,
      createdAt: opts.now,
      updatedAt: opts.now,
    });
  }

  const doorIds: Id<"doors">[] = [];
  for (let io = 0; io < opts.doorCount; io++) {
    const doorId = await ctx.db.insert("doors", {
      name: defaultDoorName(io),
      projectId: opts.projectId,
      zoneId,
      deviceId: opts.deviceId,
      ioId: io,
      status: "active",
      createdAt: opts.now,
      updatedAt: opts.now,
    });
    doorIds.push(doorId);
  }
  return { zoneId, doorIds };
}

/**
 * IDE Smart paneli ekler: cihaz (device) + N kapı (door) üretir; cihazı bir
 * bölgeye (zone) yerleştirir. Bölge ve panel AYRI kavramlardır (endüstri modeli):
 * panel kendi adını taşır, bölge mantıksal alandır ve bağımsız adlandırılır.
 * Bölge/kapı üretimi provisionPanelZoneAndDoors helper'ıyla paylaşılır.
 */
export const createIdePanel = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    // Bölge: mevcut bölge id'si VEYA yeni bölge adı. İkisi de boşsa panel adından türetilir.
    zoneId: v.optional(v.id("zones")),
    newZoneName: v.optional(v.string()),
    ideUuid: v.optional(v.string()),
    ideUser: v.optional(v.string()),
    idePassword: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    ideHttpPort: v.optional(v.number()),
    ideDoorCount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    deviceId: v.id("devices"),
    zoneId: v.id("zones"),
    doorIds: v.array(v.id("doors")),
  }),
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    const doorCount = Math.max(1, Math.min(args.ideDoorCount ?? 4, 8));

    // Cihaz (brand ide_smart). zoneId helper sonrası patch'lenir (tek transaction).
    const deviceId = await ctx.db.insert("devices", {
      name: args.name,
      projectId: args.projectId,
      brand: "ide_smart",
      deviceType: "Erişim Paneli",
      deviceIp: args.deviceIp,
      ideUuid: args.ideUuid,
      // Panel MQTT login token'ı bu kimlikle alınır → ikisi de garanti edilir
      // (frontend zorunlu kılar; doğrudan/script çağrıları için backend default'u).
      ideUser: args.ideUser ?? "admin",
      idePassword: args.idePassword ?? "admin12345",
      ideHttpPort: args.ideHttpPort ?? 80,
      ideDoorCount: doorCount,
      isActive: true,
      status: "active",
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    const { zoneId, doorIds } = await provisionPanelZoneAndDoors(ctx, {
      deviceId,
      projectId: args.projectId,
      allowedProjectIds,
      zoneId: args.zoneId,
      newZoneName: args.newZoneName,
      panelName: args.name,
      description: args.description,
      doorCount,
      now,
    });
    await ctx.db.patch(deviceId, { zoneId, updatedAt: now });

    return { deviceId, zoneId, doorIds };
  },
});

// ────────────────────────────────────────────────────────────
// Havuz modeli: Admin UUID ile atanmamış panel ekler → Cihazlar'da projeye claim
// ────────────────────────────────────────────────────────────

/**
 * Admin (super_admin) bir IDE Smart paneli UUID ile havuza ekler. Cihaz ATANMAMIŞ
 * (projectId yok) doğar; ortak varsayılan MQTT kimliği (ideDefaults) satıra kopyalanır.
 * Zone/door OLUŞTURULMAZ — onlar projeye claim anında üretilir (claimDevice).
 * Panel önceden Hetzner broker'ına ayarlı geldiği için UUID girilince bağlanınca
 * lastSeen üzerinden otomatik canlanır.
 */
export const registerUnassignedPanel = superAdminMutation({
  args: {
    ideUuid: v.string(),
    brand: v.optional(
      v.union(v.literal("ide_smart"), v.literal("hikvision"), v.literal("other")),
    ),
    name: v.optional(v.string()),
  },
  returns: v.id("devices"),
  handler: async (ctx, args) => {
    const ideUuid = args.ideUuid.trim();
    if (!ideUuid) throw new Error("UUID gerekli");

    // Tekillik: aynı UUID iki cihaza yazılırsa event/komut yönlendirmesi bozulur.
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
      .first();
    if (existing) throw new Error("Bu UUID zaten kayıtlı");

    // Ortak varsayılan kimliği oku (singleton) → satıra kopyala. Bridge op-zamanı
    // device.ideUser/idePassword okuduğu için dinamik değil, kopya gerekir.
    const defaults = await ctx.db.query("ideDefaults").first();
    const ideUser = defaults?.ideUser ?? "admin";
    const idePassword = defaults?.idePassword ?? "admin12345";
    const ideDoorCount = defaults?.ideDoorCount ?? 4;

    const now = new Date().toISOString();
    return await ctx.db.insert("devices", {
      name: args.name?.trim() || ideUuid,
      // projectId YOK → atanmamış (havuzda). isProjectAllowed undefined'ı reddeder,
      // bu yüzden normal kullanıcıya görünmez; super_admin devices.list'te görür.
      brand: args.brand ?? "ide_smart",
      deviceType: "Erişim Paneli",
      ideUuid,
      ideUser,
      idePassword,
      ideHttpPort: 80,
      ideDoorCount,
      isActive: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Havuzdaki atanmamış bir cihazı bir projeye claim eder (tek projeye özel).
 * project_admin sadece kendi projesine; super_admin her projeye. Atama anında
 * zone + door üretilir (provisionPanelZoneAndDoors). Cihaz zaten atanmışsa reddedilir
 * (çift-claim; Convex OCC eşzamanlı claim'leri seri hale getirir → kaybeden bu guard'a takılır).
 * adminMutation: claim yönetimsel iş (project_user değil) — listClaimable (adminQuery) ile tutarlı.
 */
export const claimDevice = adminMutation({
  args: {
    deviceId: v.id("devices"),
    projectId: v.id("projects"),
    zoneId: v.optional(v.id("zones")),
    newZoneName: v.optional(v.string()),
    name: v.optional(v.string()),
    ideDoorCount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    deviceId: v.id("devices"),
    zoneId: v.id("zones"),
    doorIds: v.array(v.id("doors")),
  }),
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (!allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    if (device.projectId !== undefined) {
      throw new Error("Bu cihaz zaten bir projeye atanmış");
    }

    const now = new Date().toISOString();
    const doorCount = Math.max(1, Math.min(args.ideDoorCount ?? device.ideDoorCount ?? 4, 8));
    const panelName = args.name?.trim() || device.name;

    // Önce doğrula + üret; başarısız claim orphan bırakmasın diye device patch en sonda.
    const { zoneId, doorIds } = await provisionPanelZoneAndDoors(ctx, {
      deviceId: args.deviceId,
      projectId: args.projectId,
      allowedProjectIds,
      zoneId: args.zoneId,
      newZoneName: args.newZoneName,
      panelName,
      description: args.description,
      doorCount,
      now,
    });

    await ctx.db.patch(args.deviceId, {
      projectId: args.projectId,
      zoneId,
      name: panelName,
      ideDoorCount: doorCount,
      updatedAt: now,
    });

    return { deviceId: args.deviceId, zoneId, doorIds };
  },
});

/**
 * Cihazı projeden çıkarıp havuza geri alır. remove temizliğini aynalar ama cihaz
 * satırını SİLMEZ: card readings, groupDevices, kapılar silinir; bölge KORUNUR
 * (paylaşılan mantıksal alan). apiToken temizlenir (başka projeye claim'de sızmasın).
 * ideUuid/kimlik/lastSeen korunur → havuzda canlı tekrar görünür.
 * adminMutation: yıkıcı + claim ile simetrik (project_user değil).
 */
export const releaseDevice = adminMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      throw new Error("Bu cihaza erişim yetkiniz yok");
    }

    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    await Promise.all(readings.map((r) => ctx.db.delete(r._id)));

    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", args.deviceId),
      )
      .collect();
    await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));

    const ownedDoors = await ctx.db
      .query("doors")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    await Promise.all(ownedDoors.map((d) => ctx.db.delete(d._id)));

    await ctx.db.patch(args.deviceId, {
      projectId: undefined,
      zoneId: undefined,
      doorId: undefined,
      apiToken: undefined,
      apiTokenCreatedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Cihazlar sayfası claim picker'ı için: atanmamış (projectId yok) cihazlar.
 * adminQuery — claim yönetimsel iş (super_admin + project_admin). devices.list
 * bunları normal kullanıcıya açamaz çünkü isProjectAllowed undefined'ı reddeder.
 */
export const listClaimable = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("devices"),
      name: v.string(),
      brand: v.optional(
        v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart")),
      ),
      ideUuid: v.optional(v.string()),
      ideDoorCount: v.optional(v.number()),
      lastSeen: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("devices")
      .withIndex("by_project", (q) => q.eq("projectId", undefined))
      .collect();
    // Yalnız picker'ın ihtiyacı olan alanlar — paylaşılan MQTT kimliği (ideUser/idePassword)
    // ve apiToken project_admin'lere tel üstünden GÖNDERİLMEZ (least-privilege).
    return rows.map((d) => ({
      _id: d._id,
      name: d.name,
      brand: d.brand,
      ideUuid: d.ideUuid,
      ideDoorCount: d.ideDoorCount,
      lastSeen: d.lastSeen,
    }));
  },
});

// ────────────────────────────────────────────────────────────
// Hik Device Gateway internal helpers
// ────────────────────────────────────────────────────────────

export const getByIdInternal = internalQuery({
  args: { id: v.id("devices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Gateway'e kayıtlı tüm aktif Hikvision cihazların devIndex listesi.
 * Günlük saat senkronu / nightly reconcile cron'ları kullanır.
 */
export const listRegisteredHikDevIndexes = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const devices = await ctx.db.query("devices").collect();
    return devices
      .filter(
        (d) =>
          d.brand === "hikvision" &&
          !!d.hikDevIndex &&
          d.isActive !== false,
      )
      .map((d) => d.hikDevIndex as string);
  },
});

export const setHikDevIndex = internalMutation({
  args: {
    deviceId: v.id("devices"),
    hikDevIndex: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikDevIndex: args.hikDevIndex ?? undefined,
      hikOfflineHint: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setHikDoorCount = internalMutation({
  args: { deviceId: v.id("devices"), doorCount: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikDoorCount: args.doorCount,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setHikOfflineHint = internalMutation({
  args: { deviceId: v.id("devices"), hint: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikOfflineHint: args.hint,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const applyGatewayHeartbeat = internalMutation({
  args: {
    hikDevIndex: v.string(),
    online: v.boolean(),
    deviceIp: v.optional(v.string()),
    model: v.optional(v.string()),
    /**
     * Caller'ın eriştiği projeler. Boş array verilirse cross-tenant filtre
     * uygulanmaz (sadece super_admin caller'lar için). Aksi halde sadece bu
     * listedeki projelere ait cihaz patch'lenir.
     */
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_hik_dev_index", (q) =>
        q.eq("hikDevIndex", args.hikDevIndex),
      )
      .first();
    if (!device) return false;
    // Scope kontrolü:
    // - undefined → internal trusted caller (cron vb.), filtre yok
    // - [] → caller'ın hiçbir projeye yetkisi yok → deny
    // - non-empty → device.projectId bu listede olmalı; aksi halde deny
    if (args.allowedProjectIds !== undefined) {
      if (!device.projectId) return false;
      if (!args.allowedProjectIds.some((id) => id === device.projectId)) {
        return false;
      }
    }
    const patch: Record<string, unknown> = {
      hikLastSeenAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };
    if (args.online) {
      patch.hikOfflineHint = undefined;
      patch.lastSeen = new Date().toISOString();
    } else {
      patch.hikOfflineHint = "Gateway: offline";
    }
    if (args.deviceIp && !device.deviceIp) patch.deviceIp = args.deviceIp;
    if (args.model && !device.hikModel) patch.hikModel = args.model;
    await ctx.db.patch(device._id, patch);
    return true;
  },
});
