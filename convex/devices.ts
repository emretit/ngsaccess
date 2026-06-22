import { internalMutation, internalQuery } from "./_generated/server";
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
import { getProjectIdsForUser, isProjectAllowed, isManager } from "./lib/auth";
import { resolvePanelAuthorizedCards } from "./lib/accessGraph";
import { resolveHikModelSpec } from "./lib/hikModels";
import {
  purgeDeviceCascade,
  provisionPanelZoneAndDoors,
  provisionHikDoorsAndReaders,
} from "./lib/deviceHelpers";
import { claimAdminDeviceCore } from "./lib/devicePool";

/**
 * Cihazın hassas alanları. list okuma-gate'i (non-manager'a gizle) ile update yazma-gate'i
 * (non-manager yazamaz) AYNI listeyi kullanır — drift = wipe/leak regresyonu. apiToken update
 * arg'larında yok (yalnız regenerateApiToken yazar) → write loop'ta hiç görünmez; sette durması
 * zararsız ve okuma-gate'iyle simetriyi korur.
 */
const DEVICE_SECRET_FIELDS = ["devicePassword", "idePassword", "ehomeKey", "apiToken"] as const;
const DEVICE_SECRET_FIELD_SET: ReadonlySet<string> = new Set(DEVICE_SECRET_FIELDS);

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let devices;
    if (args.projectId) {
      // Aktif proje filtresi — super_admin dahil yalnızca seçili projenin cihazları.
      if (!allowedProjectIds.some((id) => id === args.projectId)) return [];
      devices = await ctx.db
        .query("devices")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else if (ctx.user.role === "super_admin") {
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

    // Panel sırları (şifre/anahtar/event token) yalnız yönetebilen role döner. authedQuery
    // herhangi bir proje kullanıcısına açık olduğundan, role-gate olmadan tüm üyelere sızardı.
    // Cihaz yönetimi UI'da zaten isAdmin ile gated; admin tam veriyle pre-fill eder, izleyici
    // sır almaz. update yazma-gate'iyle AYNI DEVICE_SECRET_FIELDS listesi (drift yok).
    const manager = isManager(ctx.user);
    return await Promise.all(
      devices.map(async (device) => {
        const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
        const door = device.doorId ? await ctx.db.get(device.doorId) : null;
        const result = { ...device, zone, door };
        if (!manager) {
          for (const f of DEVICE_SECRET_FIELDS) result[f] = undefined;
        }
        return result;
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
    // Sır alanları yalnız yönetebilen role döner — list ile AYNI gate (drift yok).
    // authedQuery her proje üyesine açık; public query'ler frontend çağırmasa da
    // client'tan doğrudan çağrılabildiğinden role-gate olmadan sır sızardı.
    const result = { ...device, zone, door };
    if (!isManager(ctx.user)) {
      for (const f of DEVICE_SECRET_FIELDS) result[f] = undefined;
    }
    return result;
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    doorId: v.optional(v.id("doors")),
    doorCount: v.optional(v.number()),
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
    hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
    hikDoorCount: v.optional(v.number()),
    hikPort: v.optional(v.number()),
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
    const deviceId = await ctx.db.insert("devices", {
      ...args,
      isActive: args.isActive ?? true,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
    const adminDeviceId = await ctx.db.insert("adminDevices", {
      name: args.name,
      brand: args.brand,
      ideUuid: args.ideUuid,
      deviceSerial: args.deviceSerial,
      ideUser: args.ideUser,
      idePassword: args.idePassword,
      ideHttpPort: args.ideHttpPort,
      ideDoorCount: args.ideDoorCount,
      assignedDeviceId: deviceId,
      assignedProjectId: args.projectId,
      createdFromDevice: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
    return deviceId;
  },
});

export const update = authedMutation({
  args: {
    deviceId: v.id("devices"),
    name: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    doorId: v.optional(v.id("doors")),
    doorCount: v.optional(v.number()),
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
    hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
    hikDoorCount: v.optional(v.number()),
    hikPort: v.optional(v.number()),
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
    // list okuma-gate'iyle SİMETRİK yazma-gate: panel sırlarını yalnız yönetici yazabilir.
    // list bu alanları non-manager'a undefined döndürdüğü için, form onları "" olarak geri
    // gönderir (localBridge'de boş=temizle); manager-olmayanın yazmasını engellemezsek bu
    // paneli sessizce silerdi. UI gating'e güvenmeyiz — sunucu otoritedir. (apiToken zaten
    // update arg'larında yok → DEVICE_SECRET_FIELD_SET'te durması bu loop'ta etkisiz.)
    const manager = isManager(ctx.user);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) continue;
      if (!manager && DEVICE_SECRET_FIELD_SET.has(k)) continue;
      clean[k] = v;
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
      // Okuyucular da zoneId denormalize taşır (by_zone tutarlılığı) → onları da eşitle.
      const panelReaders = await ctx.db
        .query("readers")
        .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
        .collect();
      await Promise.all(
        panelReaders.map((reader) =>
          ctx.db.patch(reader._id, { zoneId: args.zoneId, updatedAt: new Date().toISOString() })
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

    // Otomatik oluşturulan adminDevices kaydını da sil.
    // Havuzdan gelen (createdFromDevice olmayan) kayıtlar silinmez, sadece assignment temizlenir.
    if (device.adminDeviceId) {
      const adminDevice = await ctx.db.get(device.adminDeviceId);
      if (adminDevice) {
        if (adminDevice.createdFromDevice) {
          await ctx.db.delete(device.adminDeviceId);
        } else {
          await ctx.db.patch(device.adminDeviceId, {
            assignedDeviceId: undefined,
            assignedProjectId: undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    await purgeDeviceCascade(ctx, args.deviceId, device.projectId);
  },
});

/** HTTP action'dan çağrılır — cihazdan herhangi bir POST gelince lastSeen günceller. */
export const updateLastSeen = internalMutation({
  args: {
    /** Token doğrulanmış istekte cihaz buraya sabitlenir; body serial/IP'ye güvenilmez. */
    deviceId: v.optional(v.id("devices")),
    deviceSerial: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    hikDevIndex: v.optional(v.string()),
    ehomeID: v.optional(v.string()),
    ideUuid: v.optional(v.string()),
  },
  handler: async (ctx, { deviceId, deviceSerial, deviceIp, hikDevIndex, ehomeID, ideUuid }) => {
    const now = new Date().toISOString();
    // Token sahibine sabitle: pin (deviceId) varsa body tanımlayıcılarına HİÇ bakma —
    // aksi halde bir token sahibi forged serial/IP ile başka tenant cihazının lastSeen'ini
    // ("online") flip edebilirdi. Skip'i yapısal tut (processCardReading ile aynı şekil):
    // tüm body lookup'ları else içinde → ileride dal eklenince guard unutulamaz.
    let device = null;
    if (deviceId) {
      device = await ctx.db.get(deviceId);
    } else {
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
    } else if (!deviceId && ideUuid) {
      // Cihaz henüz projeye atanmamış (adminDevices'ta) olabilir — orada da lastSeen güncelle.
      // (Token-pinned istekte buraya düşülmez: yanlış adminDevices'a attribution olmasın.)
      const adminDevice = await ctx.db
        .query("adminDevices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
        .first();
      if (adminDevice) {
        await ctx.db.patch(adminDevice._id, { lastSeen: now });
      }
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
    if (args.ideUuid) {
      const existingDevice = await ctx.db
        .query("devices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid!))
        .first();
      if (existingDevice) throw new Error("Bu UUID zaten bir cihaza kayıtlı");
      const existingAdmin = await ctx.db
        .query("adminDevices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid!))
        .first();
      if (existingAdmin) throw new Error("Bu UUID zaten havuzda kayıtlı");
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

    // adminDevices'a otomatik kaydet (createdFromDevice=true → cihaz silinince de silinir)
    const adminDeviceId = await ctx.db.insert("adminDevices", {
      name: args.name,
      brand: "ide_smart",
      ideUuid: args.ideUuid,
      ideUser: args.ideUser ?? "admin",
      idePassword: args.idePassword ?? "admin12345",
      ideHttpPort: args.ideHttpPort ?? 80,
      ideDoorCount: doorCount,
      assignedDeviceId: deviceId,
      assignedProjectId: args.projectId,
      createdFromDevice: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });

    return { deviceId, zoneId, doorIds };
  },
});

/**
 * Hikvision cihazı ekler: cihaz + kapıları (hikDoorNo 1..N) + okuyucuları tek mutation'da
 * üretir, bir bölgeye yerleştirir. Model seçiminden gelen `doorCount`/`readersPerDoor`
 * topolojiyi belirler (createIdePanel deseni). Gateway kaydı (ehome) ayrıca submission
 * tarafında registerDeviceOnGateway ile yapılır — bu mutation panele bağlanmaz.
 */
export const createHikDevice = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    newZoneName: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
    hikModel: v.optional(v.string()),
    hikFamily: v.optional(v.union(v.literal("controller"), v.literal("terminal"))),
    doorCount: v.number(),
    readersPerDoor: v.number(),
    deviceIp: v.optional(v.string()),
    deviceSerial: v.optional(v.string()),
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikPort: v.optional(v.number()),
    accessDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    status: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    deviceId: v.id("devices"),
    zoneId: v.id("zones"),
    doorIds: v.array(v.id("doors")),
    readerIds: v.array(v.id("readers")),
  }),
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    const doorCount = Math.max(1, Math.min(args.doorCount, 8));
    // Okuyucu/kapı üst sınırını modele göre kıs — UI 1 gönderir; doğrudan API çağrısı
    // sınırsız okuyucu yaratmasın (terminal=1, kontrolör=2). Sunucu otoritedir.
    const maxReaders = resolveHikModelSpec(args.hikModel, doorCount).maxReadersPerDoor;
    const readersPerDoor = Math.max(1, Math.min(args.readersPerDoor, maxReaders));

    const deviceId = await ctx.db.insert("devices", {
      name: args.name,
      projectId: args.projectId,
      brand: "hikvision",
      deviceType: args.deviceType,
      deviceIp: args.deviceIp,
      deviceSerial: args.deviceSerial,
      deviceUsername: args.deviceUsername,
      devicePassword: args.devicePassword,
      ehomeID: args.ehomeID,
      ehomeKey: args.ehomeKey,
      hikModel: args.hikModel,
      hikTransport: args.hikTransport,
      hikDoorCount: doorCount,
      hikPort: args.hikPort,
      accessDirection: args.accessDirection,
      isActive: true,
      status: args.status ?? "active",
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    const { zoneId, doorIds, readerIds } = await provisionHikDoorsAndReaders(ctx, {
      deviceId,
      projectId: args.projectId,
      allowedProjectIds,
      zoneId: args.zoneId,
      newZoneName: args.newZoneName,
      deviceName: args.name,
      description: args.description,
      doorCount,
      readersPerDoor,
      family: args.hikFamily,
      now,
    });
    await ctx.db.patch(deviceId, { zoneId, updatedAt: now });

    // adminDevices'a otomatik kaydet (createdFromDevice=true → cihaz silinince de silinir) —
    // generic create ile aynı havuz/temizlik davranışı.
    const adminDeviceId = await ctx.db.insert("adminDevices", {
      name: args.name,
      brand: "hikvision",
      deviceSerial: args.deviceSerial,
      assignedDeviceId: deviceId,
      assignedProjectId: args.projectId,
      createdFromDevice: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });

    return { deviceId, zoneId, doorIds, readerIds };
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
 * adminDevices havuzundaki cihazı bir projeye claim eder.
 * adminDevices kaydı SİLİNMEZ — assignedDeviceId + assignedProjectId set edilir.
 * devices tablosuna projectId + adminDeviceId ile yeni kayıt eklenir.
 * Zone + door atama anında üretilir (provisionPanelZoneAndDoors).
 * adminMutation: claim yönetimsel iş (project_user değil).
 */
export const claimDevice = adminMutation({
  args: {
    adminDeviceId: v.id("adminDevices"),
    projectId: v.id("projects"),
    zoneId: v.optional(v.id("zones")),
    newZoneName: v.optional(v.string()),
    name: v.optional(v.string()),
    ideDoorCount: v.optional(v.number()),
    ideUser: v.optional(v.string()),
    idePassword: v.optional(v.string()),
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
    const adminDevice = await ctx.db.get(args.adminDeviceId);
    if (!adminDevice) throw new Error("Cihaz bulunamadı");
    if (adminDevice.assignedDeviceId) {
      throw new Error("Bu cihaz zaten bir projeye atanmış");
    }

    return await claimAdminDeviceCore(ctx, {
      adminDevice,
      projectId: args.projectId,
      allowedProjectIds,
      zoneId: args.zoneId,
      newZoneName: args.newZoneName,
      name: args.name,
      ideDoorCount: args.ideDoorCount,
      ideUser: args.ideUser,
      idePassword: args.idePassword,
      description: args.description,
      now: new Date().toISOString(),
    });
  },
});

/**
 * Envanter (admin) sayfasından cihaz düzenleme: isim ve/veya proje atamasını değiştirir.
 * - Proje değişimi YIKICIDIR: atanmış cihaz önce mevcut projeden sökülür
 *   (kapılar + groupDevices + kart okuma geçmişi silinir), sonra hedef projeye yeniden
 *   claim edilir. adminDevices havuz kaydı KORUNUR (release'in createdFromDevice silme
 *   davranışına girilmez) → kimlik/ad kaybolmaz.
 * - Hedef proje undefined ise cihaz yalnızca havuza döner (atama temizlenir).
 * - Proje değişmiyorsa yalnızca isim güncellenir (havuz + atanmış device).
 * adminMutation: yönetimsel + yıkıcı.
 */
export const reassignDevice = adminMutation({
  args: {
    adminDeviceId: v.id("adminDevices"),
    projectId: v.optional(v.id("projects")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const adminDevice = await ctx.db.get(args.adminDeviceId);
    if (!adminDevice) throw new Error("Cihaz bulunamadı");

    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }

    const now = new Date().toISOString();
    const newName = args.name?.trim();
    if (newName && newName !== adminDevice.name) {
      await ctx.db.patch(args.adminDeviceId, { name: newName, updatedAt: now });
    }

    // Proje değişmiyorsa: atanmış device adını da senkronla, bitir.
    if (adminDevice.assignedProjectId === args.projectId) {
      if (newName && adminDevice.assignedDeviceId) {
        await ctx.db.patch(adminDevice.assignedDeviceId, { name: newName, updatedAt: now });
      }
      return;
    }

    // Mevcut atamayı söküm (varsa) — havuz kaydı KORUNUR, yalnızca assignment temizlenir.
    if (adminDevice.assignedDeviceId) {
      const assigned = await ctx.db.get(adminDevice.assignedDeviceId);
      if (assigned) {
        if (!isProjectAllowed(allowedProjectIds, assigned.projectId)) {
          throw new Error("Mevcut projeye erişim yetkiniz yok");
        }
        await purgeDeviceCascade(ctx, assigned._id, assigned.projectId);
      }
      await ctx.db.patch(args.adminDeviceId, {
        assignedDeviceId: undefined,
        assignedProjectId: undefined,
        updatedAt: now,
      });
    }

    // Hedef projeye yeniden ata (varsa). Patch sonrası güncel kaydı oku.
    if (args.projectId) {
      const fresh = await ctx.db.get(args.adminDeviceId);
      if (!fresh) throw new Error("Cihaz bulunamadı");
      await claimAdminDeviceCore(ctx, {
        adminDevice: fresh,
        projectId: args.projectId,
        allowedProjectIds,
        name: newName ?? fresh.name,
        now,
      });
    }
  },
});

/**
 * Cihazı projeden çıkarır ve adminDevices havuzuna geri koyar.
 * card readings, groupDevices ve panelin kapıları silinir; bölge KORUNUR.
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

    // adminDevices kaydını temizle:
    // - createdFromDevice=true → cihazla birlikte doğdu, birlikte ölmeli
    // - pool kaydı → havuza geri döner (sadece assignment temizlenir)
    const adminDeviceId = device.adminDeviceId;
    if (adminDeviceId) {
      const adminDevice = await ctx.db.get(adminDeviceId);
      if (adminDevice) {
        if (adminDevice.createdFromDevice) {
          await ctx.db.delete(adminDeviceId);
        } else {
          await ctx.db.patch(adminDeviceId, {
            assignedDeviceId: undefined,
            assignedProjectId: undefined,
            lastSeen: device.lastSeen ?? undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } else if (device.ideUuid) {
      // Eski akışla eklenmiş (adminDeviceId yok) — UUID ile bul
      const existing = await ctx.db
        .query("adminDevices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", device.ideUuid!))
        .first();
      if (existing) {
        if (existing.createdFromDevice) {
          await ctx.db.delete(existing._id);
        } else {
          await ctx.db.patch(existing._id, {
            assignedDeviceId: undefined,
            assignedProjectId: undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // devices tablosundan sil
    await ctx.db.delete(args.deviceId);
  },
});

/**
 * Cihazlar sayfası claim picker'ı için: adminDevices tablosundaki kayıtlar.
 * adminQuery — claim yönetimsel iş (super_admin + project_admin).
 * @deprecated Kullan: api.adminDevices.listForClaim — bu alias geriye uyum için kalır.
 */
export const listClaimable = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("adminDevices"),
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
    const rows = await ctx.db.query("adminDevices").collect();
    return rows
      .filter((d) => !d.assignedDeviceId && !d.createdFromDevice)
      .map((d) => ({
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

/**
 * AcsEvent backfill cron için online gateway cihazlarını listeler.
 * "Online" = son 10 dk içinde hikLastSeenAt'i güncellenmiş.
 */
export const listOnlineGatewayDevicesForBackfill = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      _id: Id<"devices">;
      hikDevIndex: string;
      hikBackfillCursor?: number;
      hikLastBackfillAt?: number;
    }>
  > => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const devices = await ctx.db.query("devices").collect();
    return devices
      .filter(
        (d) =>
          d.brand === "hikvision" &&
          d.hikTransport === "gateway" &&
          !!d.hikDevIndex &&
          d.isActive !== false &&
          typeof d.hikLastSeenAt === "number" &&
          d.hikLastSeenAt >= tenMinutesAgo,
      )
      .map((d) => ({
        _id: d._id,
        hikDevIndex: d.hikDevIndex as string,
        hikBackfillCursor: d.hikBackfillCursor,
        hikLastBackfillAt: d.hikLastBackfillAt,
      }));
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

export const setHikWorkStatus = internalMutation({
  args: {
    deviceId: v.id("devices"),
    workStatus: v.object({
      updatedAt: v.number(),
      doorStatus: v.optional(v.array(v.number())),
      magneticStatus: v.optional(v.array(v.number())),
      cardReaderOnlineStatus: v.optional(v.array(v.number())),
      batteryVoltage: v.optional(v.number()),
      powerSupplyStatus: v.optional(v.string()),
      raw: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikWorkStatus: args.workStatus,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setHikLastRebootAt = internalMutation({
  args: { deviceId: v.id("devices"), at: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikLastRebootAt: args.at,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setHikBackfillProgress = internalMutation({
  args: {
    deviceId: v.id("devices"),
    cursor: v.optional(v.number()),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      ...(args.cursor !== undefined ? { hikBackfillCursor: args.cursor } : {}),
      hikLastBackfillAt: args.at,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Çalışanın cardNumber'ını döner (captureFaceFromDevice için employeeNo iletimi).
 */
export const getEmployeeCardNumber = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args): Promise<string | null> => {
    const emp = await ctx.db.get(args.employeeId);
    return emp?.cardNumber?.trim() ?? null;
  },
});

/**
 * Employee dokümanını internal olarak döner. Faz 7D: captureFaceFromDevice proje-scope
 * kontrolü için — employee.projectId'yi doğrulamak gerekiyor.
 */
export const getEmployeeByIdInternal = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.employeeId);
  },
});

/**
 * Bir Hikvision cihazına yetkili çalışanların kart numaralarını döner.
 * Reconcile action'ının "beklenen roster" bacağı için kullanılır.
 *
 * Kanonik iki-bacak yetki çözümünü accessGraph.resolvePanelAuthorizedCards'tan
 * REUSE eder (cihaz bağı + CANLI kapı bağı + isActive guard + taşınmış-kapı inceliği).
 * IDE normalize yerine Hik için ham trim geçilir — cardNumber cihazda ham string.
 */
export const getHikAuthorizedCardNumbers = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args): Promise<string[]> => {
    const { authorized } = await resolvePanelAuthorizedCards(
      ctx,
      args.deviceId,
      (c) => (typeof c === "string" && c.trim() ? c.trim() : null),
    );
    return Array.from(authorized);
  },
});

/**
 * Cihaza yetkili çalışanlardan ngsaccess'te YÜZ kaydı olanların cardNumber'larını döner.
 *
 * Eşleme (kanıt: hikvisionSync.ts satır 744 — addFaceToDevice(devIndex, employee.cardNumber, ...)):
 *   cihaz employeeNo = ngsaccess employee.cardNumber
 *
 * Yetki çözümü: resolvePanelAuthorizedCards ile aynı iki-bacak mantığı (cihaz bağı + kapı bağı).
 * Bunun üstüne: yetkili employee'lerin employeeFaces tablosunda kaydı var mı filtresi.
 *
 * Reconcile "beklenen yüz roster" bacağı.
 */
export const getHikDeviceFaceRoster = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args): Promise<string[]> => {
    // ── Yetkili employee ID seti ─────────────────────────────────────────────
    // resolvePanelAuthorizedCards'ın iki-bacak kural çözümünü burada da uyguluyoruz;
    // fark: kart normalizer yerine employeeId'leri topluyoruz.
    const [deviceLinks, panelDoors] = await Promise.all([
      ctx.db
        .query("groupDevices")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect(),
      ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect(),
    ]);

    const ruleIds = new Set<Id<"accessRules">>(deviceLinks.map((l) => l.groupId));
    await Promise.all(
      panelDoors.map(async (door) => {
        const doorLinks = await ctx.db
          .query("groupDoors")
          .withIndex("by_door", (q) => q.eq("doorId", door._id))
          .collect();
        for (const dl of doorLinks) ruleIds.add(dl.groupId);
      }),
    );

    const authorizedEmpIds = new Set<Id<"employees">>();
    await Promise.all(
      Array.from(ruleIds).map(async (ruleId) => {
        const rule = await ctx.db.get(ruleId);
        if (!rule || rule.isActive === false) return;
        const members = await ctx.db
          .query("groupMembers")
          .withIndex("by_project_group", (q) =>
            q.eq("projectId", rule.projectId).eq("groupId", ruleId),
          )
          .collect();
        for (const m of members) authorizedEmpIds.add(m.employeeId);
      }),
    );

    // ── Yüz kaydı olanları filtrele ─────────────────────────────────────────
    // cardNumber başına tek kayıt — aynı cardNumber'ı paylaşan iki employee yüz
    // sayımını şişirmesin (fingerprint roster ile tutarlı dedup).
    const seen = new Set<string>();
    for (const employeeId of authorizedEmpIds) {
      const face = await ctx.db
        .query("employeeFaces")
        .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
        .first();
      if (!face) continue;
      const emp = await ctx.db.get(employeeId);
      const cardNumber = emp?.cardNumber?.trim();
      if (cardNumber) seen.add(cardNumber);
    }
    return Array.from(seen);
  },
});

/**
 * Cihaza yetkili çalışanlardan ngsaccess'te PARMAK İZİ kaydı olanların cardNumber'larını döner.
 *
 * Eşleme (kanıt: hikvisionSync.ts satır 881 — addFingerprintToDevice({ employeeNo: employee.cardNumber, ... })):
 *   cihaz employeeNo = ngsaccess employee.cardNumber
 *
 * Reconcile "beklenen parmak izi roster" bacağı.
 */
export const getHikDeviceFingerprintRoster = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args): Promise<string[]> => {
    // ── Yetkili employee ID seti (getHikDeviceFaceRoster ile aynı yetki çözümü) ──
    const [deviceLinks, panelDoors] = await Promise.all([
      ctx.db
        .query("groupDevices")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect(),
      ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect(),
    ]);

    const ruleIds = new Set<Id<"accessRules">>(deviceLinks.map((l) => l.groupId));
    await Promise.all(
      panelDoors.map(async (door) => {
        const doorLinks = await ctx.db
          .query("groupDoors")
          .withIndex("by_door", (q) => q.eq("doorId", door._id))
          .collect();
        for (const dl of doorLinks) ruleIds.add(dl.groupId);
      }),
    );

    const authorizedEmpIds = new Set<Id<"employees">>();
    await Promise.all(
      Array.from(ruleIds).map(async (ruleId) => {
        const rule = await ctx.db.get(ruleId);
        if (!rule || rule.isActive === false) return;
        const members = await ctx.db
          .query("groupMembers")
          .withIndex("by_project_group", (q) =>
            q.eq("projectId", rule.projectId).eq("groupId", ruleId),
          )
          .collect();
        for (const m of members) authorizedEmpIds.add(m.employeeId);
      }),
    );

    // ── Parmak izi kaydı olanları filtrele ──────────────────────────────────
    // cardNumber başına tek kayıt — aynı employee'nin birden fazla parmağı olsa da tek entry.
    const seen = new Set<string>();
    for (const employeeId of authorizedEmpIds) {
      const fp = await ctx.db
        .query("employeeFingerprints")
        .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
        .first();
      if (!fp) continue;
      const emp = await ctx.db.get(employeeId);
      const cardNumber = emp?.cardNumber?.trim();
      if (cardNumber) seen.add(cardNumber);
    }
    return Array.from(seen);
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
