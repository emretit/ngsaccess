/**
 * Kart okuma kayıtlarını görüntü/audit için zenginleştiren ctx-bağımlı helper'lar.
 *
 * Saf DEĞİL (DB okur) — `shiftResolver.buildShiftResolver(ctx, …)` gibi `ctx`
 * alır. cardReadings.ts'teki list / getRecentByProjects / listForEmployee
 * wrapper'larından çağrılır; dönen shape **birebir** korunur (AI chat + audit
 * log UI + mobil bağımlı).
 */
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { liveReadingSource } from "./liveReadings";
import { hikDoorReaderNumbers } from "./hikDoorReaders";

async function loadDevicesById(
  ctx: QueryCtx,
  readings: Doc<"cardReadings">[],
): Promise<Map<Id<"devices">, Doc<"devices">>> {
  const deviceIds = [
    ...new Set(
      readings
        .map((reading) => reading.deviceId)
        .filter((id): id is Id<"devices"> => id !== undefined),
    ),
  ];
  const devices = await Promise.all(deviceIds.map((id) => ctx.db.get(id)));
  return new Map(
    devices
      .filter((device): device is Doc<"devices"> => device !== null)
      .map((device) => [device._id, device]),
  );
}

/**
 * `list` query'si için zenginleştirme: IDE Smart okumaların kapı/okuyucu eşlemesi
 * (ideIoId → doors.ioId, sayfa başına tek batch ile N+1 önlenir), cihaz adı/seri,
 * çalışan departmanı.
 */
export async function enrichReadingsForList(
  ctx: QueryCtx,
  readings: Doc<"cardReadings">[],
  /** Already matched by listFiltered; avoids a second Hik door lookup. */
  matchedHikDoor?: Doc<"doors">,
) {
  const devicesById = await loadDevicesById(ctx, readings);
  // IDE Smart okumaların kapı/okuyucu eşlemesi: ideIoId (panel actuator) →
  // doors.ioId. Sayfadaki paneller için doors'u bir kez topla (N+1 önler).
  const ideDeviceIds = [
    ...new Set(
      readings
        .filter((r) => r.ideIoId !== undefined && r.deviceId)
        .map((r) => r.deviceId as Id<"devices">),
    ),
  ];
  const doorsByDevice = new Map<Id<"devices">, Doc<"doors">[]>();
  const hikDeviceIds = [...new Set(readings
    .filter(r => r.ideIoId === undefined && r.hikCardReaderNo !== undefined && r.deviceId !== matchedHikDoor?.deviceId)
    .map(r => r.deviceId).filter((id): id is Id<"devices"> => id !== undefined))];
  const hikDoorsByDevice = new Map<Id<"devices">, Map<number, Doc<"doors"> | null>>();
  await Promise.all(
    ideDeviceIds.map(async (did) => {
      const doors = await ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", did))
        .collect();
      doorsByDevice.set(did, doors);
    }),
  );
  let remainingDoors = 1000;
  let remainingReaders = 2000;
  for (const did of hikDeviceIds) {
    const device = devicesById.get(did);
    if (device?.brand !== "hikvision") continue;
    const [doors, readers] = await Promise.all([
      doorsByDevice.has(did) ? Promise.resolve(doorsByDevice.get(did) ?? []) : ctx.db.query("doors")
        .withIndex("by_device", q => q.eq("deviceId", did)).take(Math.min(101, remainingDoors + 1)),
      ctx.db.query("readers").withIndex("by_device", q => q.eq("deviceId", did)).take(Math.min(201, remainingReaders + 1)),
    ]);
    if (doors.length > 100 || readers.length > 200) throw new Error("Hik kapı eşlemesi sınırı aşıldı (100 kapı / 200 okuyucu)");
    remainingDoors -= doors.length;
    remainingReaders -= readers.length;
    if (remainingDoors < 0 || remainingReaders < 0) throw new Error("Hik kapı eşlemesi istek sınırı aşıldı (1000 kapı / 2000 okuyucu)");
    const map = new Map<number, Doc<"doors"> | null>();
    for (const door of doors) {
      if (door.projectId !== device.projectId || door.ioId !== undefined) continue;
      for (const number of hikDoorReaderNumbers(door, readers.filter(reader => reader.doorId === door._id))) {
        // Ambiguous configuration must never assign a reading to the wrong door.
        map.set(number, map.has(number) ? null : door);
      }
    }
    hikDoorsByDevice.set(did, map);
  }

  return await Promise.all(
    readings.map(async (r) => {
      const device = r.deviceId
        ? devicesById.get(r.deviceId) ?? null
        : null;
      const employee = r.employeeId
        ? ((await ctx.db.get(r.employeeId)) as Doc<"employees"> | null)
        : null;
      let department: Doc<"departments"> | null = null;
      if (employee?.departmentId) {
        department = (await ctx.db.get(
          employee.departmentId,
        )) as Doc<"departments"> | null;
      }
      const door =
        r.ideIoId !== undefined && r.deviceId
          ? doorsByDevice.get(r.deviceId)?.find((d) => d.ioId === r.ideIoId && d.projectId === r.projectId)
          : matchedHikDoor?.deviceId === r.deviceId && matchedHikDoor?.projectId === r.projectId
            ? matchedHikDoor
            : r.deviceId && r.hikCardReaderNo !== undefined
              ? hikDoorsByDevice.get(r.deviceId)?.get(r.hikCardReaderNo)
              : undefined;
      return {
        ...r,
        source: liveReadingSource(r),
        devices: device
          ? { name: device.name, deviceSerial: device.deviceSerial }
          : null,
        door: door && door.projectId === r.projectId
          ? {
              _id: door._id,
              name: door.name,
              readerName: door.readerName,
              readerDirection: door.readerDirection,
            }
          : null,
        employees: employee
          ? {
              _id: employee._id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              departments: department ? { name: department.name } : null,
            }
          : null,
      };
    }),
  );
}

/**
 * `getRecentByProjects` için hafif zenginleştirme: erişim bool + cihaz adı.
 */
export async function enrichWithDeviceName(
  ctx: QueryCtx,
  readings: Doc<"cardReadings">[],
) {
  const devicesById = await loadDevicesById(ctx, readings);
  return readings.map((r) => ({
    ...r,
    source: liveReadingSource(r),
    access_granted: r.accessStatus === "izin_verildi",
    device_name: r.deviceId
      ? devicesById.get(r.deviceId)?.name ?? "Bilinmeyen Cihaz"
      : "Bilinmeyen Cihaz",
  }));
}

/**
 * `listForEmployee` (mobil) için cihaz bilgisi.
 */
export async function enrichWithDeviceInfo(
  ctx: QueryCtx,
  readings: Doc<"cardReadings">[],
) {
  const devicesById = await loadDevicesById(ctx, readings);
  const enriched = await Promise.all(readings.map(async (r) => {
    const candidate = r.deviceId ? devicesById.get(r.deviceId) : undefined;
    const employee = r.employeeId ? await ctx.db.get(r.employeeId) : null;
    if (!r.projectId || employee?.projectId !== r.projectId) return null;
    const device = candidate?.projectId === r.projectId ? candidate : undefined;
    return {
      ...r,
      source: liveReadingSource(r),
      device: device
        ? {
            _id: device._id,
            name: device.name,
            description: device.description ?? null,
            deviceSerial: device.deviceSerial ?? null,
          }
        : null,
    };
  }));
  return enriched.filter((row): row is NonNullable<typeof row> => row !== null);
}
