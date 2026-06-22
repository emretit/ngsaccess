/**
 * IDE Smart havuz (adminDevices) → proje claim çekirdeği.
 *
 * ctx-bağımlı (DB yazar). devices.ts'in claimDevice / reassignDevice registered
 * wrapper'larından çağrılır; yetki + "zaten atanmış" kontrolü çağırana aittir.
 */
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { provisionPanelZoneAndDoors } from "./deviceHelpers";

/**
 * Bir havuz (adminDevices) kaydını projeye bağlar: devices satırı + zone + door üretir,
 * havuz kaydını assigned olarak işaretler. claimDevice ve reassignDevice ortak kullanır.
 * Çağıran tarafın yetki + "zaten atanmış" kontrolünü yapması beklenir.
 */
export async function claimAdminDeviceCore(
  ctx: MutationCtx,
  opts: {
    adminDevice: Doc<"adminDevices">;
    projectId: Id<"projects">;
    allowedProjectIds: Id<"projects">[];
    zoneId?: Id<"zones">;
    newZoneName?: string;
    name?: string;
    ideDoorCount?: number;
    ideUser?: string;
    idePassword?: string;
    description?: string;
    now: string;
  },
): Promise<{ deviceId: Id<"devices">; zoneId: Id<"zones">; doorIds: Id<"doors">[] }> {
  const { adminDevice, now } = opts;
  const doorCount = Math.max(1, Math.min(opts.ideDoorCount ?? adminDevice.ideDoorCount ?? 4, 8));
  const panelName = opts.name?.trim() || adminDevice.name;
  // Girilen kimlik bilgisi öncelikli; boşsa havuz kaydındakine düş.
  // Bridge MQTT login için device.ideUser/idePassword okur — boş kalırsa op sonsuza pending'de bekler.
  const ideUser = opts.ideUser?.trim() || adminDevice.ideUser;
  const idePassword = opts.idePassword?.trim() || adminDevice.idePassword;

  // devices tablosuna ekle (projectId + adminDeviceId geri bağlantısı ile)
  const deviceId = await ctx.db.insert("devices", {
    name: panelName,
    projectId: opts.projectId,
    brand: adminDevice.brand ?? "ide_smart",
    deviceType: "Erişim Paneli",
    ideUuid: adminDevice.ideUuid,
    ideUser,
    idePassword,
    ideHttpPort: adminDevice.ideHttpPort ?? 80,
    ideDoorCount: doorCount,
    isActive: true,
    status: "active",
    lastSeen: adminDevice.lastSeen,
    description: opts.description,
    adminDeviceId: adminDevice._id,
    createdAt: now,
    updatedAt: now,
  });

  const { zoneId, doorIds } = await provisionPanelZoneAndDoors(ctx, {
    deviceId,
    projectId: opts.projectId,
    allowedProjectIds: opts.allowedProjectIds,
    zoneId: opts.zoneId,
    newZoneName: opts.newZoneName,
    panelName,
    description: opts.description,
    doorCount,
    now,
  });

  await ctx.db.patch(deviceId, { zoneId, updatedAt: now });

  // adminDevices'ı güncelle — atandı olarak işaretle + kimlik bilgisini havuz kaydına da yaz
  // (release edilirse havuza güncel kimlikle döner).
  await ctx.db.patch(adminDevice._id, {
    assignedDeviceId: deviceId,
    assignedProjectId: opts.projectId,
    ideUser,
    idePassword,
    updatedAt: now,
  });

  return { deviceId, zoneId, doorIds };
}
