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

/**
 * `list` query'si için zenginleştirme: IDE Smart okumaların kapı/okuyucu eşlemesi
 * (ideIoId → doors.ioId, sayfa başına tek batch ile N+1 önlenir), cihaz adı/seri,
 * çalışan departmanı.
 */
export async function enrichReadingsForList(
  ctx: QueryCtx,
  readings: Doc<"cardReadings">[],
) {
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
  await Promise.all(
    ideDeviceIds.map(async (did) => {
      const doors = await ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", did))
        .collect();
      doorsByDevice.set(did, doors);
    }),
  );

  return await Promise.all(
    readings.map(async (r) => {
      const device = r.deviceId
        ? ((await ctx.db.get(r.deviceId)) as Doc<"devices"> | null)
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
          ? doorsByDevice.get(r.deviceId)?.find((d) => d.ioId === r.ideIoId)
          : undefined;
      return {
        ...r,
        devices: device
          ? { name: device.name, deviceSerial: device.deviceSerial }
          : null,
        door: door
          ? {
              name: door.name,
              readerName: door.readerName,
              readerDirection: door.readerDirection,
            }
          : null,
        employees: employee
          ? {
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
  return await Promise.all(
    readings.map(async (r) => {
      const device = r.deviceId
        ? ((await ctx.db.get(r.deviceId)) as Doc<"devices"> | null)
        : null;
      return {
        ...r,
        access_granted: r.accessStatus === "izin_verildi",
        device_name: device?.name ?? "Bilinmeyen Cihaz",
      };
    }),
  );
}

/**
 * `listForEmployee` (mobil) için cihaz bilgisi.
 */
export async function enrichWithDeviceInfo(
  ctx: QueryCtx,
  readings: Doc<"cardReadings">[],
) {
  return await Promise.all(
    readings.map(async (r) => {
      const device = r.deviceId
        ? ((await ctx.db.get(r.deviceId)) as Doc<"devices"> | null)
        : null;
      return {
        ...r,
        device: device
          ? {
              _id: device._id,
              name: device.name,
              description: device.description ?? null,
              deviceSerial: device.deviceSerial ?? null,
            }
          : null,
      };
    }),
  );
}
