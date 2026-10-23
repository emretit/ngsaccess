"use node";

import { requirePlanCapabilities, getHolidayCapacity, setDoorStatusHolidayPlan, setDoorStatusHolidayGroup } from "./gateway/plans";
import { buildDoorStatusSegments, buildVerifySegments } from "./doorStatusPlan";
import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { canAccessEmployeeProject, isProjectAllowed } from "./auth";
import { deriveHikReaderNoFromDoorNo } from "./hikReaderNumbers";
import { withDeviceToken } from "./cardReaderAuth";
import type { Doc, Id } from "../_generated/dataModel";
import {
  addDeviceToGateway,
  captureCardOnDevice,
  captureFaceOnDevice,
  deleteDeviceFromGateway,
  fetchHikCapabilitySnapshot,
  fetchCardReaderSnapshot,
  getDoorCapabilities,
  getAcsWorkStatus,
  listGatewayDevices,
  linkDoorStatusPlan,
  linkVerifyPlan,
  openDoor,
  pingGateway,
  rebootDeviceOnGateway,
  setDeviceTime,
  setDoorStatusPlanTemplate,
  setDoorStatusWeekPlan,
  setHttpHostForwarding,
  setVerifyPlanTemplate,
  setVerifyWeekPlan,
  type HikCapabilitySnapshot,
  type HikCardReaderSnapshot,
} from "./hikGateway";

export async function auditDeviceCommand<T extends { ok: boolean; queued?: boolean; error?: string }>(
  ctx: ActionCtx,
  deviceId: Id<"devices">,
  label: string,
  run: () => Promise<T>,
  summarize?: (result: T) => string | undefined,
): Promise<T> {
  let result: T;
  try {
    result = await run();
  } catch (error: unknown) {
    try {
      await ctx.runMutation(internal.deviceEvents.recordOperationInternal, {
        deviceId, label: `${label}: başarısız`, ok: false,
        summary: (error instanceof Error ? error.message : "Bilinmeyen hata").replace(/\d{6,}/g, "…").slice(0, 200),
      });
    } catch {
      console.warn("Cihaz komutu audit kaydı yazılamadı", { deviceId, label });
    }
    throw error;
  }
  try {
    await ctx.runMutation(internal.deviceEvents.recordOperationInternal, {
      deviceId,
      label: `${label}: ${result.ok ? result.queued ? "sıraya alındı" : "komut iletildi" : "başarısız"}`,
      ok: result.ok,
      summary: result.ok ? summarize?.(result) : result.error?.replace(/\d{6,}/g, "…").slice(0, 200),
    });
  } catch {
    console.warn("Cihaz komutu audit kaydı yazılamadı", { deviceId, label });
  }
  return result;
}

export async function runRegisterDeviceOnGateway(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{ ok: boolean; devIndex?: string; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "devices.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (!device.ehomeID) {
    return { ok: false, error: "ehomeID tanımlı değil (cihazın Device ID'si)" };
  }

  const ehomeID = device.ehomeID;
  return await auditDeviceCommand(ctx, args.deviceId, "Gateway'e kaydet", async () => {
    const result = await addDeviceToGateway({
      devName: device.name,
      ehomeID,
      ehomeKey: device.ehomeKey,
      devType: "accessControl",
    });

    if (!result.ok || !result.devIndex) {
      await ctx.runMutation(internal.devices.setHikOfflineHint, {
        deviceId: args.deviceId,
        hint: result.error ?? "Gateway'e kayıt başarısız",
      });
      return { ok: false, error: result.error };
    }

    await ctx.runMutation(internal.devices.setHikDevIndex, {
      deviceId: args.deviceId,
      hikDevIndex: result.devIndex,
    });

    // Door discovery — başarısızsa default 1 kapı (tek-kapı cihazlar için doğru).
    const caps = await getDoorCapabilities(result.devIndex);
    if (caps.ok && caps.doorNum && caps.doorNum > 0) {
      await ctx.runMutation(internal.devices.setHikDoorCount, {
        deviceId: args.deviceId,
        doorCount: caps.doorNum,
      });
    }

    // Cihaz saatini TR local'e set et — drift'le Valid window/week plan bozulmasın.
    // Başarısızsa günlük cron tekrar dener.
    await setDeviceTime(result.devIndex);

    // Forwarding'i otomatik ayarla — kart event'leri direkt Convex'e gelsin.
    // Başarısızsa register'ı geri almıyoruz; UI'da uyarı olarak görünür.
    const forwardingUrl = process.env.HIK_FORWARDING_URL;
    if (forwardingUrl) {
      // /card-reader token'sız isteği reddeder; httpHosts header ekleyemediği için
      // cihaz token'ı URL'e gömülür (event cihaza sabitlenir, cross-tenant forge yok).
      const token = await ctx.runMutation(internal.devices.ensureApiToken, {
        deviceId: args.deviceId,
      });
      const fwd = await setHttpHostForwarding(
        result.devIndex,
        token ? withDeviceToken(forwardingUrl, token) : forwardingUrl,
      );
      if (!fwd.ok) {
        await ctx.runMutation(internal.devices.setHikOfflineHint, {
          deviceId: args.deviceId,
          hint: `Kayıt OK ama forwarding ayarlanamadı: ${fwd.error ?? "?"}`,
        });
      }
    }

    // Initial backfill: bu cihazın bağlı olduğu erişim gruplarındaki tüm
    // çalışanları + week plan'ı sync için zamanla. Tek-seferlik yeni-cihaz işi.
    await ctx.scheduler.runAfter(
      0,
      internal.actions.hikGatewayDevice.backfillDeviceFromGroups,
      { deviceId: args.deviceId },
    );

    return { ok: true, devIndex: result.devIndex };
  });
}

export async function runSyncHikDeviceTimes(
  ctx: ActionCtx
): Promise<{ updated: number; failed: number }> {
  const list = await ctx.runQuery(internal.devices.listRegisteredHikDevIndexes, {});
  let updated = 0;
  let failed = 0;
  for (const devIndex of list) {
    const res = await setDeviceTime(devIndex);
    if (res.ok) updated++;
    else failed++;
  }
  return { updated, failed };
}

export async function runRemoveDeviceFromGateway(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{ ok: boolean; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "devices.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (!device.hikDevIndex) return { ok: true };

  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Gateway'den kaldır", async () => {
    const result = await deleteDeviceFromGateway(devIndex);
    if (result.ok) {
      await ctx.runMutation(internal.devices.setHikDevIndex, {
        deviceId: args.deviceId,
        hikDevIndex: null,
      });
    }
    return result;
  });
}

export async function runRefreshGatewayDeviceStatus(
  ctx: ActionCtx & { user: Doc<"users"> }
): Promise<{ scanned: number; updated: number; offline: number }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  // Caller'ın hiç projesi yoksa erken çık — mutation'da scope check var ama
  // her cihaz için gereksiz roundtrip atmamak ve sızıntı vektörünü kapatmak için.
  if (allowedProjectIds.length === 0) {
    return { scanned: 0, updated: 0, offline: 0 };
  }
  const permitted = await Promise.all(allowedProjectIds.map(async projectId => {
    const ok: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId, permission: "devices.manage" });
    return ok ? projectId : null;
  }));
  const manageableIds = permitted.filter((id): id is Id<"projects"> => id !== null);
  if (!manageableIds.length) throw new Error("Bu işlem için yetkiniz yok");
  const list = await listGatewayDevices();
  const results = await Promise.all(
    list
      .filter((gw) => !!gw.devIndex)
      .map((gw) =>
        ctx.runMutation(internal.devices.applyGatewayHeartbeat, {
          hikDevIndex: gw.devIndex,
          online: gw.online ?? false,
          deviceIp: gw.ipAddress,
          model: gw.model,
          allowedProjectIds: manageableIds,
        }).then((patched) => ({ patched, online: gw.online ?? false })),
      ),
  );
  const updated = results.filter((r) => r.patched).length;
  const offline = results.filter((r) => r.patched && !r.online).length;
  return { scanned: list.length, updated, offline };
}

export async function runPingHikGateway(
  
): Promise<{
    ok: boolean;
    model?: string;
    version?: string;
    error?: string;
  }> {
  try {
    return await pingGateway();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function runFetchDeviceCapabilities(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{ ok: boolean; snapshot?: HikCapabilitySnapshot; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "devices.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (device.hikTransport !== "gateway") {
    return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return {
      ok: false,
      error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
    };
  }

  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Özellikleri tara", async (): Promise<{ ok: boolean; snapshot?: HikCapabilitySnapshot; error?: string }> => {
    const snapshot = await fetchHikCapabilitySnapshot(devIndex);
    await ctx.runMutation(internal.devices.setHikCapabilitiesSnapshot, {
      deviceId: args.deviceId,
      snapshot: JSON.stringify(snapshot),
      updatedAt: snapshot.updatedAt,
    });
    return { ok: true, snapshot };
  });
}

export async function runRemoteOpenDoor(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices">; doorNo?: number }
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "doors.open" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  return await auditDeviceCommand(ctx, args.deviceId, "Kapı aç", async (): Promise<{ ok: boolean; queued?: boolean; error?: string }> => {
    if (device.hikTransport === "localBridge") {
      await ctx.runMutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
        deviceId: device._id,
        projectId: device.projectId,
        operation: "openDoor",
        payload: { doorNo: args.doorNo ?? 1 },
      });
      return { ok: true, queued: true };
    }
    if (!device.hikDevIndex) {
      return {
        ok: false,
        error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
      };
    }
    return await openDoor(device.hikDevIndex, args.doorNo ?? 1);
  });
}

export async function runRebootDevice(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{ ok: boolean; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "devices.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (device.hikTransport !== "gateway") {
    return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return {
      ok: false,
      error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
    };
  }
  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Yeniden başlat", async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await rebootDeviceOnGateway(devIndex);
    if (result.ok) {
      await ctx.runMutation(internal.devices.setHikLastRebootAt, {
        deviceId: args.deviceId,
        at: Date.now(),
      });
    }
    return result;
  });
}

export async function runFetchDeviceWorkStatus(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{
    ok: boolean;
    status?: {
      updatedAt: number;
      doorStatus?: number[];
      magneticStatus?: number[];
      cardReaderOnlineStatus?: number[];
      batteryVoltage?: number;
      powerSupplyStatus?: string;
      raw?: string;
    };
    error?: string;
  }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "devices.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (device.hikTransport !== "gateway") {
    return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return {
      ok: false,
      error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
    };
  }
  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Çalışma durumu", async (): Promise<{
      ok: boolean;
      status?: {
        updatedAt: number;
        doorStatus?: number[];
        magneticStatus?: number[];
        cardReaderOnlineStatus?: number[];
        batteryVoltage?: number;
        powerSupplyStatus?: string;
        raw?: string;
      };
      error?: string;
  }> => {
    const result = await getAcsWorkStatus(devIndex);
    if (!result.ok) return { ok: false, error: result.error };

    const workStatus = {
      updatedAt: Date.now(),
      doorStatus: result.status?.doorStatus,
      magneticStatus: result.status?.magneticStatus,
      cardReaderOnlineStatus: result.status?.cardReaderOnlineStatus,
      batteryVoltage: result.status?.batteryVoltage,
      powerSupplyStatus: result.status?.powerSupplyStatus,
      raw: result.status?.raw,
    };
    await ctx.runMutation(internal.devices.setHikWorkStatus, {
      deviceId: args.deviceId,
      workStatus,
    });
    return { ok: true, status: workStatus };
  });
}

export async function runCaptureCardFromDevice(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{ ok: boolean; cardNo?: string; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "employees.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (device.hikTransport !== "gateway") {
    return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return { ok: false, error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
  }
  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Kart okut", async (): Promise<{ ok: boolean; cardNo?: string; error?: string }> => {
    const result = await captureCardOnDevice(devIndex);
    return { ok: result.ok, cardNo: result.cardNo, error: result.error };
  });
}

export async function runCaptureFaceFromDevice(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices">; employeeId?: Id<"employees"> }
): Promise<{ ok: boolean; faceDataBase64?: string; faceURL?: string; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  // employeeId verilmişse: (1) proje-scope kontrolü, (2) cardNumber'ı employeeNo olarak al
  let employeeNo: string | undefined;
  if (args.employeeId) {
    // Faz 7D: defense-in-depth — cihaz gate'iyle simetri.
    // getEmployeeCardNumber yalnız cardNumber döndürür; employee projesini bilmez.
    // O yüzden employee'yi internal'dan çekip projectId'yi doğruluyoruz.
    const employee = await ctx.runQuery(internal.devices.getEmployeeByIdInternal, {
      employeeId: args.employeeId,
    });
    if (!employee) {
      return { ok: false, error: "Çalışan bulunamadı" };
    }
    if (!canAccessEmployeeProject(ctx.user.role, allowedProjectIds, employee.projectId)) {
      return { ok: false, error: "Bu çalışana erişim yetkiniz yok" };
    }
    employeeNo = employee.cardNumber?.trim() ?? undefined;
  }

  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "biometrics.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  await ctx.runQuery(internal.privacyBiometric.assertBiometricDeviceAllowed, { deviceId: args.deviceId });
  if (device.hikTransport !== "gateway") {
    return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return { ok: false, error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
  }

  const result = await captureFaceOnDevice(device.hikDevIndex, { employeeNo });
  return {
    ok: result.ok,
    faceDataBase64: result.faceDataBase64,
    faceURL: result.faceURL,
    error: result.error,
  };
}

export async function runApplyDoorStatusPlan(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { doorId: Id<"doors"> },
): Promise<{ ok: boolean; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const door = await ctx.runQuery(internal.doors.getByIdInternal, {
    id: args.doorId,
  });
  if (!door) return { ok: false, error: "Kapı bulunamadı" };
  if (!door.deviceId) return { ok: false, error: "Kapıya bağlı cihaz yok" };

  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: door.deviceId,
  });
  if (
    !device ||
    device.projectId !== door.projectId ||
    device.brand !== "hikvision"
  )
    return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(
    internal.roles.checkPermission,
    {
      userId: ctx.user._id,
      projectId: device.projectId,
      permission: "accessRules.manage",
    },
  );
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  return sendStoredDoorStatusPlan(ctx, door, device);
}

export async function runFetchReaderCfg(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { readerId: Id<"readers"> },
): Promise<{ ok: boolean; snapshot?: HikCardReaderSnapshot; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const reader = await ctx.runQuery(internal.readers.getByIdInternal, {
    readerId: args.readerId,
  });
  if (!reader) return { ok: false, error: "Okuyucu bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, reader.projectId)) {
    return { ok: false, error: "Bu okuyucuya erişim yetkiniz yok" };
  }

  const permitted: boolean = await ctx.runQuery(
    internal.roles.checkPermission,
    {
      userId: ctx.user._id,
      projectId: reader.projectId,
      permission: "devices.manage",
    },
  );
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  const door = await ctx.runQuery(internal.doors.getByIdInternal, {
    id: reader.doorId,
  });
  if (!door) return { ok: false, error: "Kapı bulunamadı" };
  const deviceId = reader.deviceId ?? door.deviceId;
  if (!deviceId) return { ok: false, error: "Okuyucuya bağlı cihaz yok" };

  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: deviceId,
  });
  if (!device) return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  if (device.brand !== "hikvision" || device.hikTransport !== "gateway") {
    return {
      ok: false,
      error: "Bu işlem yalnızca Hikvision gateway cihazlarında desteklenir",
    };
  }
  if (!device.hikDevIndex) {
    return { ok: false, error: "Cihaz gateway'e kayıtlı değil" };
  }

  const readerNo =
    reader.hikReaderNo ??
    deriveHikReaderNoFromDoorNo(door.hikDoorNo, reader.direction);
  if (readerNo === undefined) {
    return { ok: false, error: "Okuyucu numarası tanımsız" };
  }

  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(
    ctx,
    deviceId,
    "Okuyucu ayarlarını oku",
    async (): Promise<{
      ok: boolean;
      snapshot?: HikCardReaderSnapshot;
      error?: string;
    }> => {
      const snapshot = await fetchCardReaderSnapshot(devIndex, readerNo);
      await ctx.runMutation(internal.readers.setHikReaderSnapshot, {
        readerId: args.readerId,
        snapshot: JSON.stringify(snapshot),
        updatedAt: snapshot.updatedAt,
        hikVerifyMode: undefined,
        hikCardReaderName: snapshot.summary.cardReaderName,
        hikCardReaderPlanTemplateNo: snapshot.summary.templateNo,
        hikCardReaderAntiSneakEnabled: snapshot.summary.antiSneakEnabled,
      });

      return { ok: true, snapshot };
    },
  );
}

export async function runApplyVerifyPlan(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { doorId: Id<"doors"> },
): Promise<{ ok: boolean; error?: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const door = await ctx.runQuery(internal.doors.getByIdInternal, {
    id: args.doorId,
  });
  if (!door) return { ok: false, error: "Kapı bulunamadı" };
  if (!door.deviceId) return { ok: false, error: "Kapıya bağlı cihaz yok" };

  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: door.deviceId,
  });
  if (
    !device ||
    device.projectId !== door.projectId ||
    device.brand !== "hikvision"
  )
    return { ok: false, error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
  }
  const permitted: boolean = await ctx.runQuery(
    internal.roles.checkPermission,
    {
      userId: ctx.user._id,
      projectId: device.projectId,
      permission: "accessRules.manage",
    },
  );
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  return sendStoredVerifyPlan(ctx, door, device);
}

async function trackPlanResult(
  ctx: ActionCtx,
  door: Doc<"doors">,
  key: "status" | "verify",
  run: () => Promise<{ ok: boolean; error?: string }>,
) {
  let result: { ok: boolean; error?: string };
  try {
    result = await run();
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : "Plan gönderilemedi",
    };
  }
  await ctx.runMutation(internal.doors.recordPlanResult, {
    doorId: door._id,
    revision: door.hikPlanRevision ?? 0,
    key,
    ...(!result.ok ? { error: result.error || "Plan gönderilemedi" } : {}),
  });
  return result;
}

export async function sendStoredDoorStatusPlan(
  ctx: ActionCtx,
  door: Doc<"doors">,
  device: Doc<"devices">,
): Promise<{ ok: boolean; error?: string }> {
  if (
    door.deviceId !== device._id ||
    door.projectId !== device.projectId ||
    device.brand !== "hikvision"
  )
    return { ok: false, error: "Kapı ve cihaz eşleşmiyor" };
  return trackPlanResult(ctx, door, "status", async () => {
    if (device.hikTransport !== "gateway") {
      return {
        ok: false,
        error: "Bu işlem yalnızca gateway transport'ta desteklenir",
      };
    }
    if (!device.hikDevIndex) {
      return {
        ok: false,
        error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
      };
    }

    const devIndex = device.hikDevIndex;

    // hikDoorNo tanımsızsa sessiz ?‌? 1 kullanma — aynı cihazda iki kapı slot 1'de çakışır.
    if (
      door.hikDoorNo === undefined ||
      !Number.isInteger(door.hikDoorNo) ||
      door.hikDoorNo < 1
    ) {
      return {
        ok: false,
        error:
          "Kapı numarası (hikDoorNo) tanımsız — kapıyı düzenleyip numara girin",
      };
    }
    const doorNo = door.hikDoorNo;
    const planNo = doorNo;
    const templateNo = doorNo + 100;
    const plan = door.hikDoorStatusPlan;

    return await auditDeviceCommand(
      ctx,
      device._id,
      "Kapı durum planı uygula",
      async () => {
        const holiday = door.hikDoorHolidayPlan;
        const active = plan?.enabled || holiday?.enabled;
        await requirePlanCapabilities(devIndex, [
          "isSupportDoorStatusPlan",
          ...(active
            ? [
                "isSupportDoorStatusWeekPlanCfg",
                "isSupportDoorStatusPlanTemplate",
              ]
            : []),
          ...(holiday?.enabled
            ? [
                "isSupportDoorStatusHolidayPlanCfg",
                "isSupportDoorStatusHolidayGroupCfg",
              ]
            : []),
        ]);
        if (!active) {
          return await linkDoorStatusPlan(devIndex, doorNo, 0);
        }

        const segments = plan?.enabled ? buildDoorStatusSegments(plan) : [];
        let holidayGroupNo: number | undefined;
        if (holiday?.enabled) {
          const ranges = await ctx.runQuery(internal.doors.getPlanHolidays, {
            doorId: door._id,
          });
          if (!ranges.length) throw new Error("Seçilen yılda uygulanacak tatil yok");
          const max = await getHolidayCapacity(devIndex, doorNo);
          const slots = await ctx.runMutation(
            internal.doors.reserveHolidaySlots,
            { doorId: door._id, count: ranges.length, max },
          );
          for (const [index, range] of ranges.entries()) {
            const slot = slots[index];
            if (slot === undefined)
              throw new Error("Tatil planı slotu bulunamadı");
            const result = await setDoorStatusHolidayPlan(
              devIndex,
              slot,
              range,
              holiday.mode,
            );
            if (!result.ok) return result;
          }
          const group = await setDoorStatusHolidayGroup(
            devIndex,
            doorNo,
            slots,
          );
          if (!group.ok) return group;
          holidayGroupNo = doorNo;
        }

        const r1 = await setDoorStatusWeekPlan(devIndex, planNo, segments);
        if (!r1.ok) return r1;

        const r2 = await setDoorStatusPlanTemplate(devIndex, templateNo, {
          weekPlanNo: planNo,
          holidayGroupNo,
        });
        if (!r2.ok) return r2;

        return await linkDoorStatusPlan(devIndex, doorNo, templateNo);
      },
    );
  });
}

export async function sendStoredVerifyPlan(
  ctx: ActionCtx,
  door: Doc<"doors">,
  device: Doc<"devices">,
): Promise<{ ok: boolean; error?: string }> {
  if (
    door.deviceId !== device._id ||
    door.projectId !== device.projectId ||
    device.brand !== "hikvision"
  )
    return { ok: false, error: "Kapı ve cihaz eşleşmiyor" };
  return trackPlanResult(ctx, door, "verify", async () => {
    if (device.hikTransport !== "gateway") {
      return {
        ok: false,
        error: "Bu işlem yalnızca gateway transport'ta desteklenir",
      };
    }
    if (!device.hikDevIndex) {
      return {
        ok: false,
        error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
      };
    }

    const devIndex = device.hikDevIndex;

    // hikDoorNo tanımsızsa sessiz ?‌? 1 kullanma — aynı cihazda iki kapı slot 1'de çakışır.
    if (
      door.hikDoorNo === undefined ||
      !Number.isInteger(door.hikDoorNo) ||
      door.hikDoorNo < 1
    ) {
      return {
        ok: false,
        error:
          "Kapı numarası (hikDoorNo) tanımsız — kapıyı düzenleyip numara girin",
      };
    }
    const doorNo = door.hikDoorNo;
    const plan = door.hikVerifyPlan;
    // A legacy DB record is not consent to install the newly corrected ISAPI path.
    if (plan?.enabled && !door.hikVerifyPlanSavedAt)
      return { ok: false, error: "Doğrulama planını önce açıkça kaydedin" };
    if (!plan?.enabled && !door.hikVerifyPlanReaderNos?.length) return { ok: true };
    return await auditDeviceCommand(
      ctx,
      device._id,
      "Doğrulama planı uygula",
      async () => {
        await requirePlanCapabilities(devIndex, [
          "isSupportCardReaderPlan",
          ...(plan?.enabled
            ? ["isSupportVerifyWeekPlanCfg", "isSupportVerifyPlanTemplate"]
            : []),
        ]);
        const readerNos = plan?.enabled
          ? await ctx.runQuery(internal.doors.getPlanReaders, { doorId: door._id })
          : door.hikVerifyPlanReaderNos ?? [];
        if (!readerNos.length)
          return {
            ok: false,
            error: "Kapının fiziksel okuyucu numarası bulunamadı",
          };
        for (const readerNo of readerNos) {
          if (plan?.enabled) {
            const r1 = await setVerifyWeekPlan(
              devIndex,
              readerNo,
              buildVerifySegments(plan),
            );
            if (!r1.ok) return r1;
            const r2 = await setVerifyPlanTemplate(devIndex, readerNo, {
              weekPlanNo: readerNo,
            });
            if (!r2.ok) return r2;
          }
          const linked = await linkVerifyPlan(
            devIndex,
            readerNo,
            plan?.enabled ? readerNo : 0,
          );
          if (!linked.ok) return linked;
          await ctx.runMutation(internal.doors.recordVerifyReaderBinding, {
            doorId: door._id, deviceId: device._id, doorNo,
            readerNo, linked: !!plan?.enabled,
          });
        }
        return { ok: true };
      },
    );
  });
}
