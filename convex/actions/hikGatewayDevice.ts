"use node";

import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { authedAction } from "../lib/customFunctions";
import { isProjectAllowed } from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import {
  addDeviceToGateway,
  deleteDeviceFromGateway,
  getDoorCapabilities,
  listGatewayDevices,
  openDoor,
  pingGateway,
  setDeviceTime,
  setHttpHostForwarding,
} from "../lib/hikGateway";

/**
 * Cihazı Hik Device Gateway'e kaydeder (EHOME / ISUP 5.0).
 * Cihazın ISUP modu'nda gateway IP:7661'e bağlanması gerekir; bu action gateway-tarafı
 * registration kaydını oluşturur ve dönen devIndex'i devices.hikDevIndex'e yazar.
 */
export const registerDeviceOnGateway = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; devIndex?: string; error?: string }> => {
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
    if (!device.ehomeID) {
      return { ok: false, error: "ehomeID tanımlı değil (cihazın Device ID'si)" };
    }

    const result = await addDeviceToGateway({
      devName: device.name,
      ehomeID: device.ehomeID,
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
      const fwd = await setHttpHostForwarding(result.devIndex, forwardingUrl);
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
  },
});

/**
 * Cihazın bağlı olduğu access rule'lardaki tüm çalışanlar ve week plan'lar
 * için sync action'larını zincirle. Yeni cihaz register sonrası tek seferlik.
 */
export const backfillDeviceFromGroups = internalAction({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args): Promise<{ employees: number; rules: number }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getDeviceBackfillTargets, {
      deviceId: args.deviceId,
    });
    if (!data) return { employees: 0, rules: 0 };

    // Aynı çalışan birden fazla grupta olabilir — set ile dedupe.
    const empIds = Array.from(new Set(data.employeeIds));
    const ruleIds = Array.from(new Set(data.accessRuleIds));

    // ÖNCE week plan + template push edilir, SONRA çalışanlar — çalışanın
    // bind edileceği planTemplateNo cihazda mevcut olmalı yoksa "no permission".
    await Promise.all(
      ruleIds.map((id) =>
        ctx.runAction(api.actions.hikvisionSync.syncWeekPlanToDevices, { accessRuleId: id }),
      ),
    );
    await Promise.all(
      empIds.map((id) =>
        ctx.runAction(api.actions.hikvisionSync.syncEmployeeToDevices, { employeeId: id }),
      ),
    );

    return { employees: empIds.length, rules: ruleIds.length };
  },
});

/**
 * Tüm kayıtlı Hikvision cihazların saatini TR local'e set eder.
 * Günlük cron — saat drift'le `Valid` window ve week plan eval'i bozulmasın.
 */
export const syncHikDeviceTimes = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number; failed: number }> => {
    const list = await ctx.runQuery(internal.devices.listRegisteredHikDevIndexes, {});
    let updated = 0;
    let failed = 0;
    for (const devIndex of list) {
      const res = await setDeviceTime(devIndex);
      if (res.ok) updated++;
      else failed++;
    }
    return { updated, failed };
  },
});

/**
 * Cihazı gateway'den siler. devices.hikDevIndex temizlenir.
 */
export const removeDeviceFromGateway = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
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
    if (!device.hikDevIndex) return { ok: true };

    const result = await deleteDeviceFromGateway(device.hikDevIndex);
    if (result.ok) {
      await ctx.runMutation(internal.devices.setHikDevIndex, {
        deviceId: args.deviceId,
        hikDevIndex: null,
      });
    }
    return result;
  },
});

/**
 * Gateway'deki tüm kayıtlı cihazların online/offline durumunu tarayıp devices tablosuna
 * hikLastSeenAt + hikOfflineHint olarak yansıtır. Caller'ın projelerine ait olmayan
 * cihazlar sessizce skip edilir; super_admin tüm cihazları günceller.
 */
export const refreshGatewayDeviceStatus = authedAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ scanned: number; updated: number; offline: number }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    // Caller'ın hiç projesi yoksa erken çık — mutation'da scope check var ama
    // her cihaz için gereksiz roundtrip atmamak ve sızıntı vektörünü kapatmak için.
    if (allowedProjectIds.length === 0) {
      return { scanned: 0, updated: 0, offline: 0 };
    }
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
            allowedProjectIds,
          }).then((patched) => ({ patched, online: gw.online ?? false })),
        ),
    );
    const updated = results.filter((r) => r.patched).length;
    const offline = results.filter((r) => r.patched && !r.online).length;
    return { scanned: list.length, updated, offline };
  },
});

/**
 * Gateway erişilebilirliğini test eder. Cihaz-spesifik lookup yok — sadece
 * gateway sunucusuna ulaşıp auth yapıp deviceInfo alabiliyor muyuz?
 *
 * Cihaz-specific status edit modunda devIndex/hikLastSeenAt üzerinden gösteriliyor.
 */
export const pingHikGateway = authedAction({
  args: {},
  handler: async (): Promise<{
    ok: boolean;
    model?: string;
    version?: string;
    error?: string;
  }> => {
    try {
      return await pingGateway();
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

/**
 * Cihazda kapıyı uzaktan açar (UI'daki "Kapıyı Aç" butonu için).
 */
export const remoteOpenDoor = authedAction({
  args: {
    deviceId: v.id("devices"),
    doorNo: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
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
    if (!device.hikDevIndex) {
      return {
        ok: false,
        error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
      };
    }
    return await openDoor(device.hikDevIndex, args.doorNo ?? 1);
  },
});
