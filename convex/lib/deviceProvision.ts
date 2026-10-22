/** Provisioning bodies for the public devices mutations; authorization order is preserved. */
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { getProjectIdsForUser, isProjectAllowed } from "./auth";
import { requirePermission } from "./permissions";
import { resolveHikModelSpec } from "./hikModels";
import {
  provisionPanelZoneAndDoors,
  provisionHikDoorsAndReaders,
  resolveOrCreateZone,
} from "./deviceHelpers";
import { deviceActive } from "./deviceUx";

export type CreateArgs = {
  name: string;
  projectId?: Id<"projects">;
  zoneId?: Id<"zones">;
  newZoneName?: string;
  doorId?: Id<"doors">;
  doorCount?: number;
  deviceType?: string;
  deviceIp?: string;
  deviceSerial?: string;
  accessDirection?: "entry" | "exit" | "both";
  status?: string;
  isActive?: boolean;
  description?: string;
  deviceUsername?: string;
  devicePassword?: string;
  brand?: "hikvision" | "other" | "ide_smart";
  ehomeID?: string;
  ehomeKey?: string;
  hikModel?: string;
  hikTransport?: "gateway" | "localBridge";
  hikDoorCount?: number;
  hikPort?: number;
  ideUuid?: string;
  ideUser?: string;
  idePassword?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
};

export async function createCore(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: CreateArgs,
) {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  // Admin formu projesiz cihazı bilinçli olarak havuza ekler; diğer kullanıcılar
  // yalnız erişebildikleri bir proje altında cihaz oluşturabilir.
  if (!args.projectId && ctx.user.role !== "super_admin") {
    throw new ConvexError("Cihaz oluşturmak için bir proje seçmelisiniz");
  }
  await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
  if (args.projectId && !isProjectAllowed(allowedProjectIds, args.projectId)) {
    throw new ConvexError("Bu projeye erişim yetkiniz yok");
  }
  const now = new Date().toISOString();
  const { newZoneName, ...deviceArgs } = args;
  const zoneId =
    args.zoneId || newZoneName?.trim()
      ? await resolveOrCreateZone(ctx, {
          projectId: args.projectId,
          allowedProjectIds,
          zoneId: args.zoneId,
          newZoneName,
          fallbackName: args.name,
          description: args.description,
          now,
        })
      : undefined;
  const deviceId = await ctx.db.insert("devices", {
    ...deviceArgs,
    zoneId,
    isActive: deviceActive(args.status, args.isActive),
    status: deviceActive(args.status, args.isActive) ? "active" : "inactive",
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
}

export type CreateIdePanelArgs = {
  name: string;
  status?: "active" | "inactive";
  projectId?: Id<"projects">;
  zoneId?: Id<"zones">;
  newZoneName?: string;
  ideUuid?: string;
  ideUser?: string;
  idePassword?: string;
  deviceIp?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
  description?: string;
};

export async function createIdePanelCore(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: CreateIdePanelArgs,
) {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  // Admin formu projesiz cihazı bilinçli olarak havuza ekler; diğer kullanıcılar
  // yalnız erişebildikleri bir proje altında cihaz oluşturabilir.
  if (!args.projectId && ctx.user.role !== "super_admin") {
    throw new ConvexError("Cihaz oluşturmak için bir proje seçmelisiniz");
  }
  await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
  if (args.projectId && !isProjectAllowed(allowedProjectIds, args.projectId)) {
    throw new ConvexError("Bu projeye erişim yetkiniz yok");
  }
  const ideUuid = args.ideUuid;
  if (ideUuid) {
    const existingDevice = await ctx.db
      .query("devices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
      .first();
    if (existingDevice) throw new Error("Bu UUID zaten bir cihaza kayıtlı");
    const existingAdmin = await ctx.db
      .query("adminDevices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
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
    isActive: deviceActive(args.status),
    status: deviceActive(args.status) ? "active" : "inactive",
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
}

export type CreateHikDeviceArgs = {
  name: string;
  projectId?: Id<"projects">;
  zoneId?: Id<"zones">;
  newZoneName?: string;
  deviceType?: string;
  hikTransport?: "gateway" | "localBridge";
  hikModel?: string;
  hikFamily?: "controller" | "terminal";
  doorCount: number;
  readersPerDoor: number;
  deviceIp?: string;
  deviceSerial?: string;
  deviceUsername?: string;
  devicePassword?: string;
  ehomeID?: string;
  ehomeKey?: string;
  hikPort?: number;
  accessDirection?: "entry" | "exit" | "both";
  status?: string;
  description?: string;
};

export async function createHikDeviceCore(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: CreateHikDeviceArgs,
) {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  // Admin formu projesiz cihazı bilinçli olarak havuza ekler; diğer kullanıcılar
  // yalnız erişebildikleri bir proje altında cihaz oluşturabilir.
  if (!args.projectId && ctx.user.role !== "super_admin") {
    throw new ConvexError("Cihaz oluşturmak için bir proje seçmelisiniz");
  }
  await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
  if (args.projectId && !isProjectAllowed(allowedProjectIds, args.projectId)) {
    throw new ConvexError("Bu projeye erişim yetkiniz yok");
  }
  const now = new Date().toISOString();
  const doorCount = Math.max(1, Math.min(args.doorCount, 8));
  // Okuyucu/kapı üst sınırını modele göre kıs — UI 1 gönderir; doğrudan API çağrısı
  // sınırsız okuyucu yaratmasın (terminal=1, kontrolör=2). Sunucu otoritedir.
  const maxReaders = resolveHikModelSpec(
    args.hikModel,
    doorCount,
  ).maxReadersPerDoor;
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
    isActive: deviceActive(args.status),
    status: deviceActive(args.status) ? "active" : "inactive",
    description: args.description,
    createdAt: now,
    updatedAt: now,
  });

  const { zoneId, doorIds, readerIds } = await provisionHikDoorsAndReaders(
    ctx,
    {
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
    },
  );
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
}
