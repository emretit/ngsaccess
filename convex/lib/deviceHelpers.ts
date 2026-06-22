/**
 * Cihaz cascade + provizyon (bölge/kapı/okuyucu üretimi) yardımcıları.
 *
 * Hepsi ctx-bağımlı (DB okur/yazar) — `shiftResolver.buildShiftResolver(ctx, …)`
 * gibi `ctx` alır. devices.ts'in registered wrapper'larından (remove, reassignDevice,
 * createIdePanel, createHikDevice, claimAdminDeviceCore) ve adminDevices.ts'ten çağrılır.
 * Güvenlik-hassas sır-gate / cross-tenant pin mantığı devices.ts'te KALIR (burada değil).
 */
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isProjectAllowed } from "./auth";
import { deleteReadersForDoor } from "../readers";

/**
 * Bir cihazı ve doğrudan bağlı kayıtlarını (cardReadings, groupDevices, doors) siler.
 * Bölge SİLİNMEZ — artık paylaşılan mantıksal alan; başka cihaz/kapı barındırabilir.
 * adminDevices kaydına DOKUNMAZ — assignment temizleme/silme mantığı çağırana aittir.
 */
export async function purgeDeviceCascade(
  ctx: MutationCtx,
  deviceId: Id<"devices">,
  projectId: Id<"projects"> | undefined,
) {
  const readings = await ctx.db
    .query("cardReadings")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .collect();
  await Promise.all(readings.map((r) => ctx.db.delete(r._id)));

  const groupDevices = await ctx.db
    .query("groupDevices")
    .withIndex("by_project_device", (q) =>
      q.eq("projectId", projectId).eq("deviceId", deviceId),
    )
    .collect();
  await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));

  const ownedDoors = await ctx.db
    .query("doors")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .collect();
  // Kapı silinmeden önce okuyucularını sil (orphan reader sızıntısı engeli).
  await Promise.all(ownedDoors.map((d) => deleteReadersForDoor(ctx, d._id)));
  await Promise.all(ownedDoors.map((d) => ctx.db.delete(d._id)));

  // localBridge SDK iş kuyruğu — cihaz silinince orphan kalmasın. Aksi halde "processing"
  // bir op cihaz silindikten sonra ack edilemez (ackBridgeOperation cihaz yoksa
  // not-found döner) ve sonsuza dek processing'de takılırdı. by_device_status index'i
  // sadece deviceId prefix'iyle tüm statüleri verir.
  const pendingOps = await ctx.db
    .query("hikPendingOperations")
    .withIndex("by_device_status", (q) => q.eq("deviceId", deviceId))
    .collect();
  await Promise.all(pendingOps.map((op) => ctx.db.delete(op._id)));

  await ctx.db.delete(deviceId);
}

/** IDE Smart kapı varsayılan adı: tüm aktüatörler "Kapı N" (1-indeksli). */
export function defaultDoorName(io: number): string {
  return `Kapı ${io + 1}`;
}

export type ReaderDirection = "entry" | "exit" | "both";

/** IDE Smart aktüatör index'ine göre okuyucu yönü (doors.ts/readers.ts ile aynı eşleme). */
export function readerDirectionFromIo(io: number): ReaderDirection {
  if (io === 0) return "entry";
  if (io === 1) return "exit";
  return "both";
}

/**
 * Bir panele bölge (zone) bağlar/oluşturur. createIdePanel, claimDevice ve createHikDevice
 * ortak kullanır — cross-tenant pointer kontrolü (zone.projectId eşleşmesi) tek yerde.
 * `zoneId` verilirse mevcut bölge (proje doğrulanır); verilmezse `newZoneName` ile yeni
 * bölge (boşsa `fallbackName`'den türetilir).
 */
export async function resolveOrCreateZone(
  ctx: MutationCtx,
  opts: {
    projectId?: Id<"projects">;
    allowedProjectIds: Id<"projects">[];
    zoneId?: Id<"zones">;
    newZoneName?: string;
    fallbackName: string;
    description?: string;
    now: string;
  },
): Promise<Id<"zones">> {
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
    return opts.zoneId;
  }
  return await ctx.db.insert("zones", {
    name: opts.newZoneName?.trim() || opts.fallbackName,
    projectId: opts.projectId,
    description: opts.description,
    createdAt: opts.now,
    updatedAt: opts.now,
  });
}

/** Bir kapıya okuyucu satırı ekler (provizyon yardımcıları için ortak insert). */
export async function insertReaderRow(
  ctx: MutationCtx,
  opts: {
    doorId: Id<"doors">;
    deviceId?: Id<"devices">;
    projectId?: Id<"projects">;
    zoneId?: Id<"zones">;
    name: string;
    direction: ReaderDirection;
    hikReaderNo?: number;
    ioId?: number;
    now: string;
  },
): Promise<Id<"readers">> {
  return await ctx.db.insert("readers", {
    doorId: opts.doorId,
    deviceId: opts.deviceId,
    projectId: opts.projectId,
    zoneId: opts.zoneId,
    name: opts.name,
    direction: opts.direction,
    hikReaderNo: opts.hikReaderNo,
    ioId: opts.ioId,
    status: "active",
    createdAt: opts.now,
    updatedAt: opts.now,
  });
}

/**
 * Bir panele bölge (zone) + N kapı (door) + her kapıya 1 okuyucu üretir/bağlar.
 * createIdePanel ve claimDevice ortak kullanır. Kapılar `deviceId`/`zoneId` ile bağlanır
 * (Variant 1: panelin tüm kapıları tek bölgede); okuyucu yönü ioId'den türetilir.
 * Cihaz satırının `zoneId`'sini PATCH'lemez — onu çağıran yapar.
 */
export async function provisionPanelZoneAndDoors(
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
  const zoneId = await resolveOrCreateZone(ctx, {
    projectId: opts.projectId,
    allowedProjectIds: opts.allowedProjectIds,
    zoneId: opts.zoneId,
    newZoneName: opts.newZoneName,
    fallbackName: opts.panelName,
    description: opts.description,
    now: opts.now,
  });

  const doorIds: Id<"doors">[] = [];
  for (let io = 0; io < opts.doorCount; io++) {
    const name = defaultDoorName(io);
    const doorId = await ctx.db.insert("doors", {
      name,
      projectId: opts.projectId,
      zoneId,
      deviceId: opts.deviceId,
      ioId: io,
      status: "active",
      createdAt: opts.now,
      updatedAt: opts.now,
    });
    await insertReaderRow(ctx, {
      doorId,
      deviceId: opts.deviceId,
      projectId: opts.projectId,
      zoneId,
      name,
      direction: readerDirectionFromIo(io),
      ioId: io,
      now: opts.now,
    });
    doorIds.push(doorId);
  }
  return { zoneId, doorIds };
}

/**
 * Hikvision cihazına bölge + `doorCount` kapı (hikDoorNo 1..N) + kapı başına
 * `readersPerDoor` okuyucu üretir. Kontrolörde okuyucu 1=giriş (hikReaderNo 2N-1),
 * 2=çıkış (2N); terminalde tek "both" okuyucu (terminalin kendisi okuyucu).
 * İzin modeli kapı bazlı — okuyucular panele gönderilmez (yalnız ngsplus modeli).
 */
export async function provisionHikDoorsAndReaders(
  ctx: MutationCtx,
  opts: {
    deviceId: Id<"devices">;
    projectId?: Id<"projects">;
    allowedProjectIds: Id<"projects">[];
    zoneId?: Id<"zones">;
    newZoneName?: string;
    deviceName: string;
    description?: string;
    doorCount: number;
    readersPerDoor: number;
    family?: "controller" | "terminal";
    now: string;
  },
): Promise<{ zoneId: Id<"zones">; doorIds: Id<"doors">[]; readerIds: Id<"readers">[] }> {
  const zoneId = await resolveOrCreateZone(ctx, {
    projectId: opts.projectId,
    allowedProjectIds: opts.allowedProjectIds,
    zoneId: opts.zoneId,
    newZoneName: opts.newZoneName,
    fallbackName: opts.deviceName,
    description: opts.description,
    now: opts.now,
  });

  const isTerminal = opts.family === "terminal";
  const readerCount = Math.max(1, opts.readersPerDoor);
  const doorIds: Id<"doors">[] = [];
  const readerIds: Id<"readers">[] = [];
  for (let n = 1; n <= opts.doorCount; n++) {
    const doorName = defaultDoorName(n - 1);
    const doorId = await ctx.db.insert("doors", {
      name: doorName,
      projectId: opts.projectId,
      zoneId,
      deviceId: opts.deviceId,
      hikDoorNo: n,
      status: "active",
      createdAt: opts.now,
      updatedAt: opts.now,
    });
    doorIds.push(doorId);
    for (let r = 0; r < readerCount; r++) {
      const direction: ReaderDirection = isTerminal ? "both" : r === 0 ? "entry" : "exit";
      const suffix = isTerminal ? "" : direction === "entry" ? " Giriş" : " Çıkış";
      const readerId = await insertReaderRow(ctx, {
        doorId,
        deviceId: opts.deviceId,
        projectId: opts.projectId,
        zoneId,
        name: `${doorName}${suffix}`,
        direction,
        hikReaderNo: direction === "exit" ? n * 2 : n * 2 - 1,
        now: opts.now,
      });
      readerIds.push(readerId);
    }
  }
  return { zoneId, doorIds, readerIds };
}
