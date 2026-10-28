import { requirePermission, hasPermission } from "./lib/permissions";
import { recordConnectivityTransition, deviceLastSignal, DEVICE_ONLINE_WINDOW_MS, hasFreshIsupStatus } from "./lib/deviceConnection";
import { internal } from "./_generated/api";
import { notifyAlarmIfNeeded } from "./lib/alarmNotify";
import { listMobileTargets } from "./lib/mobileAccess";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  authedQuery,
  authedMutation,
  employeeAuthedQuery,
} from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { resolvePanelAuthorizedCards } from "./lib/accessGraph";
import {
  purgeDeviceCascade,
} from "./lib/deviceHelpers";
import { resolveProjectScope } from "./lib/projectScope";
import { toPatch } from "./lib/nullablePatch";
import { validateDeviceDoor, deviceActive } from "./lib/deviceUx";
import { claimDeviceCore, reassignDeviceCore, releaseDeviceCore } from "./lib/deviceAssignment";
import { deviceIdentityError } from "./lib/deviceIdentity";
import { assertIdeUuidAvailable, assertEhomeIdAvailable, createCore, createIdePanelCore, createHikDeviceCore } from "./lib/deviceProvision";
import {
  resolveAuthorizedEmployeeIds,
  rosterCardNumbersWithBiometric,
} from "./lib/deviceSync";

/**
 * Cihazın hassas alanları. list okuma-gate'i (non-manager'a gizle) ile update yazma-gate'i
 * (non-manager yazamaz) AYNI listeyi kullanır — drift = wipe/leak regresyonu. apiToken update
 * arg'larında yok (yalnız issueApiToken yazar) → write loop'ta hiç görünmez; sette durması
 * zararsız ve okuma-gate'iyle simetriyi korur.
 */
const DEVICE_SECRET_FIELDS = ["devicePassword", "idePassword", "ehomeKey", "apiToken"] as const;
const DEVICE_SECRET_FIELD_SET: ReadonlySet<string> = new Set(DEVICE_SECRET_FIELDS);

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

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
    return await Promise.all(
      devices.map(async (device) => {
        const manager = await hasPermission(ctx, ctx.user, device.projectId, "devices.manage");
        const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
        const door = device.doorId ? await ctx.db.get(device.doorId) : null;
        const ownedDoors = await ctx.db.query("doors").withIndex("by_device", (q) => q.eq("deviceId", device._id)).collect();
        const result = { ...device, zone, door, doorIds: ownedDoors.map((row) => row._id) };
        if (!manager) {
          for (const f of DEVICE_SECRET_FIELDS) result[f] = undefined;
        }
        return result;
      })
    );
  },
});

/** Compatibility alias for the door-aware employee target list and current capability policy. */
export const listForEmployee = employeeAuthedQuery({
  args: {},
  handler: async (ctx) => await listMobileTargets(ctx, ctx.employee),
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
    if (!(await hasPermission(ctx, ctx.user, device.projectId, "devices.manage"))) {
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
    newZoneName: v.optional(v.string()),
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
    return await createCore(ctx, args);
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
    deviceIp: v.optional(v.union(v.null(), v.string())),
    deviceSerial: v.optional(v.string()),
    accessDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    status: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.union(v.null(), v.string())),
    lastSeen: v.optional(v.string()),
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    brand: v.optional(
      v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))
    ),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.union(v.null(), v.string())),
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
    await requirePermission(ctx, ctx.user, device.projectId, "devices.manage");
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
      validateDeviceDoor(device, targetDoor.deviceId === device._id && args.zoneId ? { ...targetDoor, zoneId: args.zoneId } : targetDoor, args.zoneId ?? device.zoneId);
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
    const manager = await hasPermission(ctx, ctx.user, device.projectId, "devices.manage");
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) continue;
      if (!manager && DEVICE_SECRET_FIELD_SET.has(k)) continue;
      clean[k] = v;
    }
    // Aynı ehomeID iki cihaz kaydında olamaz (iki proje aynı fiziksel cihaza yazar). Yalnız
    // değişince kontrol: eski çift kayıtlar başka alan güncellemesinde kilitlenmesin.
    if (typeof clean.ehomeID === "string") {
      const ehomeID = clean.ehomeID.trim();
      if (ehomeID !== (device.ehomeID ?? "").trim()) {
        await assertEhomeIdAvailable(ctx, ehomeID, deviceId);
      }
      clean.ehomeID = ehomeID;
    }
    if (typeof clean.ideUuid === "string") {
      const ideUuid = clean.ideUuid.trim();
      const error = deviceIdentityError(ideUuid, args.brand ?? device.brand);
      if (error) throw new ConvexError(error);
      await assertIdeUuidAvailable(ctx, ideUuid, { exceptDeviceId: deviceId });
      clean.ideUuid = ideUuid;
      // Keep the linked pool identity consistent for release and later claims.
      if (device.adminDeviceId) {
        const poolDevice = await ctx.db.get(device.adminDeviceId);
        if (poolDevice?.assignedDeviceId === deviceId) {
          await ctx.db.patch(poolDevice._id, { ideUuid, updatedAt: new Date().toISOString() });
        }
      }
    }
    if (args.status !== undefined || args.isActive !== undefined) {
      const active = deviceActive(args.status, args.isActive ?? device.isActive);
      clean.isActive = active;
      clean.status = active ? "active" : "inactive";
    }
    if (args.lastSeen !== undefined) {
      const signal = deviceLastSignal({ ...device, lastSeen: args.lastSeen });
      const nowMs = Date.now();
      if (signal !== undefined && signal <= nowMs && signal > nowMs - DEVICE_ONLINE_WINDOW_MS && signal !== deviceLastSignal(device)) {
        await recordConnectivityTransition(ctx, device, signal);
      }
    }
    await ctx.db.patch(deviceId, toPatch(clean));

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
    await requirePermission(ctx, ctx.user, device.projectId, "devices.manage");
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
      await recordConnectivityTransition(ctx, device, Date.parse(now));
      await ctx.db.patch(device._id, {
        lastSeen: now,
        hikLastSeenAt: Date.parse(now),
        hikOfflineHint: hasFreshIsupStatus(device) ? device.hikOfflineHint : undefined,
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

/** Cihaza yeni /card-reader token'ı yazar (regenerate + ensure ortak yolu). */
async function issueApiToken(
  ctx: MutationCtx,
  deviceId: Id<"devices">,
): Promise<{ token: string; createdAt: string }> {
  const token = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await ctx.db.patch(deviceId, {
    apiToken: token,
    apiTokenCreatedAt: createdAt,
    updatedAt: createdAt,
  });
  return { token, createdAt };
}

export const regenerateApiToken = authedMutation({
  args: { deviceId: v.id("devices") },
  returns: v.object({ token: v.string(), createdAt: v.string() }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    await requirePermission(ctx, ctx.user, device.projectId, "devices.manage");
    if (ctx.user.role !== "super_admin") {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (
        !device.projectId ||
        !allowedProjectIds.some((id) => id === device.projectId)
      ) {
        throw new Error("Bu cihaza erişim yetkiniz yok");
      }
    }
    return await issueApiToken(ctx, args.deviceId);
  },
});

/**
 * Cihazın /card-reader token'ı yoksa üretir, varsa aynısını döner (idempotent).
 * Gateway httpHosts forwarding URL'ine `?token=` olarak gömülür — token'sız istek
 * artık reddediliyor.
 */
export const ensureApiToken = internalMutation({
  args: { deviceId: v.id("devices") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    if (device.apiToken) return device.apiToken;
    return (await issueApiToken(ctx, args.deviceId)).token;
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
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    const ideUuid = args.ideUuid.trim();
    const error = deviceIdentityError(ideUuid);
    if (error) throw new ConvexError(error);
    await assertIdeUuidAvailable(ctx, ideUuid, { exceptDeviceId: args.deviceId });
    if (device.adminDeviceId) {
      const poolDevice = await ctx.db.get(device.adminDeviceId);
      if (poolDevice?.assignedDeviceId === device._id) {
        await ctx.db.patch(poolDevice._id, { ideUuid, updatedAt: new Date().toISOString() });
      }
    }
    await ctx.db.patch(args.deviceId, {
      ideUuid,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Başarılı login/komut sonrası paneli online işaretle. */
export const markIdeOnline = internalMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Cihaz bulunamadı");
    await recordConnectivityTransition(ctx, device, Date.parse(now));
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
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
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
    return await createIdePanelCore(ctx, args);
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
    return await createHikDeviceCore(ctx, args);
  },
});

// ────────────────────────────────────────────────────────────
// Havuz modeli: Admin UUID ile atanmamış panel ekler → Cihazlar'da projeye claim
// ────────────────────────────────────────────────────────────

/**
 * adminDevices havuzundaki cihazı bir projeye claim eder.
 * adminDevices kaydı SİLİNMEZ — assignedDeviceId + assignedProjectId set edilir.
 * devices tablosuna projectId + adminDeviceId ile yeni kayıt eklenir.
 * Zone + door atama anında üretilir (provisionPanelZoneAndDoors).
 * authedMutation: claim yönetimsel iş (viewer değil).
 */
export const claimDevice = authedMutation({
  args: {
    adminDeviceId: v.id("adminDevices"),
    expectedAssignedProjectId: v.optional(v.union(v.id("projects"), v.null())),
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
    return await claimDeviceCore(ctx, args);
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
 * authedMutation: yönetimsel + yıkıcı.
 */
export const reassignDevice = authedMutation({
  args: {
    adminDeviceId: v.id("adminDevices"),
    expectedAssignedProjectId: v.optional(v.union(v.id("projects"), v.null())),
    projectId: v.optional(v.id("projects")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await reassignDeviceCore(ctx, args);
  },
});

/**
 * Cihazı projeden çıkarır ve adminDevices havuzuna geri koyar.
 * groupDevices ve panelin kapıları silinir; bölge ve kart okuma geçmişi korunur.
 * authedMutation: yıkıcı + claim ile simetrik (viewer değil).
 */
export const releaseDevice = authedMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    return await releaseDeviceCore(ctx, args);
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

export const setHikCapabilitiesSnapshot = internalMutation({
  args: {
    deviceId: v.id("devices"),
    snapshot: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deviceId, {
      hikCapabilitiesSnapshot: args.snapshot,
      hikCapabilitiesUpdatedAt: args.updatedAt,
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
    const authorizedEmpIds = await resolveAuthorizedEmployeeIds(ctx, args.deviceId);
    return await rosterCardNumbersWithBiometric(
      ctx,
      authorizedEmpIds,
      "employeeFaces",
    );
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
    const authorizedEmpIds = await resolveAuthorizedEmployeeIds(ctx, args.deviceId);
    return await rosterCardNumbersWithBiometric(
      ctx,
      authorizedEmpIds,
      "employeeFingerprints",
      args.deviceId,
    );
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
    const now = Date.now();
    // Throttle erken dönüşünden önce eski sinyalle karşılaştır.
    const reconnected = args.online ? await recordConnectivityTransition(ctx, device, now) : false;
    const offlineHint = hasFreshIsupStatus(device, now) ? device.hikOfflineHint : args.online ? undefined : "Gateway çevrimdışı";
    const deviceIp = device.deviceIp || args.deviceIp || undefined;
    const model = device.hikModel || args.model || undefined;
    const changed = device.hikOfflineHint !== offlineHint ||
      device.deviceIp !== deviceIp || device.hikModel !== model;
    const lastHeartbeat = args.online ? device.hikLastSeenAt : Date.parse(device.updatedAt);
    if (!reconnected && !changed && lastHeartbeat !== undefined && now - lastHeartbeat < 60_000) {
      return true;
    }
    const nowIso = new Date(now).toISOString();
    await ctx.db.patch(device._id, {
      // Offline durum sorgusu başarılı cihaz sinyali değildir.
      ...(args.online ? { hikLastSeenAt: now } : {}),
      updatedAt: nowIso,
      hikOfflineHint: offlineHint,
      deviceIp,
      hikModel: model,
      ...(args.online ? { lastSeen: nowIso } : {}),
    });
    return true;
  },
});

/** Same-outage marker makes retries and an old scheduled confirmation harmless. */
async function isupOutageAlarm(ctx: MutationCtx, deviceId: Id<"devices">, offlineFrom: number) {
  const events = await ctx.db.query("deviceEvents")
    .withIndex("by_device_category_label_event_time", q => q.eq("deviceId", deviceId)
      .eq("category", "exception").eq("label", "Arıza: cihaz çevrimdışı")
      .gte("eventTime", new Date(offlineFrom).toISOString()))
    .order("desc").take(10);
  return events.find(event => {
    try {
      const data: unknown = JSON.parse(event.rawData ?? "null");
      return typeof data === "object" && data !== null &&
        "source" in data && data.source === "isup" &&
        "offlineFrom" in data && data.offlineFrom === offlineFrom;
    } catch {
      return false;
    }
  }) ?? null;
}

export const applyIsupStatus = internalMutation({
  args: {
    deviceId: v.id("devices"), devIndex: v.string(),
    status: v.union(v.literal("online"), v.literal("offline")), at: v.number(),
    source: v.optional(v.literal("snapshot")),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.brand !== "hikvision" || device.hikTransport === "localBridge" ||
      device.hikDevIndex !== args.devIndex) return false;
    const now = Date.now();
    if (!Number.isFinite(args.at) || args.at < now - 10 * 60_000 || args.at > now + 120_000) return false;
    // Equal-time retries also cannot undo a newer transition with the same timestamp.
    if (device.hikIsupStatusAt !== undefined && args.at <= device.hikIsupStatusAt) return true;
    const online = args.status === "online";
    const offlineFrom = device.hikIsupOfflineSince;
    if (online === device.hikIsupOnline) {
      await ctx.db.patch(device._id, { hikIsupStatusAt: args.at });
      return true;
    }
    if (online && offlineFrom !== undefined && args.at - offlineFrom >= DEVICE_ONLINE_WINDOW_MS) {
      const nowIso = new Date(now).toISOString();
      const endIso = new Date(args.at).toISOString();
      await ctx.db.insert("deviceEvents", {
        deviceId: device._id, projectId: device.projectId, source: "hikvision",
        category: "status", severity: "warning", label: "Çevrimdışı dönemi",
        eventTime: endIso, createdAt: nowIso, updatedAt: nowIso,
        rawData: JSON.stringify({ offlineFrom, offlineTo: args.at, durationMs: args.at - offlineFrom }),
      });
    }
    if (online && offlineFrom !== undefined) {
      const alarm = await isupOutageAlarm(ctx, device._id, offlineFrom);
      if (alarm && !alarm.resolvedAt) {
        await ctx.db.patch(alarm._id, { resolvedAt: new Date(args.at).toISOString(), updatedAt: new Date(now).toISOString() });
      }
    }
    await ctx.db.patch(device._id, {
      hikIsupOnline: online, hikIsupStatusAt: args.at,
      hikIsupOfflineSince: online ? undefined : args.at,
      hikOfflineHint: online ? undefined : "Cihaz gateway bağlantısı koptu",
    });
    if (!online) {
      await ctx.scheduler.runAfter(Math.max(0, args.at + DEVICE_ONLINE_WINDOW_MS - now), internal.devices.confirmIsupOffline, {
        deviceId: device._id, offlineFrom: args.at,
      });
    }
    return true;
  },
});

export const confirmIsupOffline = internalMutation({
  args: { deviceId: v.id("devices"), offlineFrom: v.number() },
  handler: async (ctx, args): Promise<null> => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.brand !== "hikvision" || device.hikTransport === "localBridge" ||
      device.hikIsupOnline !== false || device.hikIsupOfflineSince !== args.offlineFrom ||
      Date.now() - args.offlineFrom < DEVICE_ONLINE_WINDOW_MS) return null;
    if (await isupOutageAlarm(ctx, device._id, args.offlineFrom)) return null;
    const now = new Date().toISOString();
    const eventId = await ctx.db.insert("deviceEvents", {
      deviceId: device._id, projectId: device.projectId, source: "hikvision",
      category: "exception", severity: "warning", label: "Arıza: cihaz çevrimdışı",
      eventTime: now, createdAt: now, updatedAt: now,
      rawData: JSON.stringify({ source: "isup", offlineFrom: args.offlineFrom }),
    });
    await notifyAlarmIfNeeded(ctx, eventId);
    return null;
  },
});
