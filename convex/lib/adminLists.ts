import { ConvexError } from "convex/values";
import type { PaginationOptions } from "convex/server";
import type { Doc } from "../_generated/dataModel";

export const ADMIN_PAGE_SIZE = 50;
export const ADMIN_SCAN_LIMIT = 500;
export const ADMIN_COUNT_LIMIT = 100;

export function adminPaginationOptions(options: PaginationOptions, maxPageSize = ADMIN_PAGE_SIZE) {
  if (!Number.isInteger(options.numItems) || options.numItems < 1 || options.numItems > maxPageSize) {
    throw new ConvexError({ code: "INVALID_PAGE_SIZE", message: `Sayfa boyutu 1 ile ${maxPageSize} arasında olmalıdır.` });
  }
  return { ...options, maximumRowsRead: ADMIN_SCAN_LIMIT };
}

export function adminSearch(search: string | undefined, ...values: (string | undefined | null)[]) {
  const needle = search?.trim().toLocaleLowerCase("tr-TR") ?? "";
  return !needle || values.some(value => value?.toLocaleLowerCase("tr-TR").includes(needle));
}

export function projectName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ConvexError({ code: "PROJECT_NAME_REQUIRED", message: "Proje adını girin." });
  if (trimmed.length > 100) throw new ConvexError({ code: "PROJECT_NAME_TOO_LONG", message: "Proje adı en fazla 100 karakter olabilir." });
  return trimmed;
}

export function boundedAdminCount(scanned: number) {
  return { count: Math.min(scanned, ADMIN_COUNT_LIMIT), capped: scanned > ADMIN_COUNT_LIMIT };
}

export function adminUserRow(user: Doc<"users">, selfId: Doc<"users">["_id"], projects: {
  _id: Doc<"projects">["_id"]; name: string; isActive: boolean;
}[]) {
  return {
    _id: user._id, displayName: user.fullName?.trim() || user.name?.trim() || user.email || "Adsız kullanıcı",
    email: user.email ?? "", role: user.role ?? null, projects, isSelf: user._id === selfId,
    disabledAt: user.disabledAt, accessExpiresAt: user.accessExpiresAt,
    accessExpired: user.accessExpiresAt !== undefined && user.accessExpiresAt <= Date.now(),
    pendingSetup: user.verified === false, setupExpiresAt: user.tokenExpiresAt,
  };
}

/** Explicit legacy inventory fields; credentials remain super-admin-only as in list. */
export function adminDeviceRow(device: Doc<"adminDevices">, assignedProjectName: string | null) {
  return {
    _id: device._id, _creationTime: device._creationTime, name: device.name,
    ideUuid: device.ideUuid, deviceSerial: device.deviceSerial, brand: device.brand,
    ideUser: device.ideUser, idePassword: device.idePassword, ideHttpPort: device.ideHttpPort,
    ideDoorCount: device.ideDoorCount, lastSeen: device.lastSeen,
    createdFromDevice: device.createdFromDevice, assignedDeviceId: device.assignedDeviceId,
    assignedProjectId: device.assignedProjectId, createdAt: device.createdAt,
    updatedAt: device.updatedAt, assignedProjectName,
  };
}
