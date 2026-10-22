"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { authedAction } from "../lib/customFunctions";
import { type HikCapabilitySnapshot, type HikCardReaderSnapshot } from "../lib/hikGateway";
import {
  runRegisterDeviceOnGateway,
  runSyncHikDeviceTimes,
  runRemoveDeviceFromGateway,
  runRefreshGatewayDeviceStatus,
  runPingHikGateway,
  runFetchDeviceCapabilities,
  runRemoteOpenDoor,
  runRebootDevice,
  runFetchDeviceWorkStatus,
  runCaptureCardFromDevice,
  runCaptureFaceFromDevice,
  runApplyDoorStatusPlan,
  runFetchReaderCfg,
  runApplyVerifyPlan,
} from "../lib/gatewayCommand";
import {
  runBackfillDeviceFromGroups,
  runBackfillDeviceEvents,
  runBackfillAllDevicesEvents,
} from "../lib/gatewayBackfill";
import { runReconcileDevice } from "../lib/gatewayReconcile";

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
    return await runRegisterDeviceOnGateway(ctx, args);
  },
});

/**
 * Cihazın bağlı olduğu access rule'lardaki tüm çalışanlar ve week plan'lar
 * için sync action'larını zincirle. Yeni cihaz register sonrası tek seferlik.
 */
export const backfillDeviceFromGroups = internalAction({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args): Promise<{ employees: number; rules: number }> => {
    return await runBackfillDeviceFromGroups(ctx, args);
  },
});

/**
 * Tüm kayıtlı Hikvision cihazların saatini TR local'e set eder.
 * Günlük cron — saat drift'le `Valid` window ve week plan eval'i bozulmasın.
 */
export const syncHikDeviceTimes = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number; failed: number }> => {
    return await runSyncHikDeviceTimes(ctx);
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
    return await runRemoveDeviceFromGateway(ctx, args);
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
    return await runRefreshGatewayDeviceStatus(ctx);
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
    return await runPingHikGateway();
  },
});

/**
 * Cihaz capability snapshot'ını gateway passthrough üzerinden toplar ve devices'a yazar.
 * Diger Hikvision fazlari bu snapshot'a bakarak UI/aksiyonlari model bazli kisitlayacak.
 */
export const fetchDeviceCapabilities = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; snapshot?: HikCapabilitySnapshot; error?: string }> => {
    return await runFetchDeviceCapabilities(ctx, args);
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
  ): Promise<{ ok: boolean; queued?: boolean; error?: string }> => {
    return await runRemoteOpenDoor(ctx, args);
  },
});

/**
 * Cihazı gateway üzerinden yeniden başlatır.
 * Cihaz ~30-60s offline olur; ok dönünce hikLastRebootAt güncellenir.
 */
export const rebootDevice = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
    return await runRebootDevice(ctx, args);
  },
});

/**
 * Cihazın anlık çalışma durumunu çeker ve DB'ye yazar.
 * Dönüş: { ok, status?, error? } — status UI'da gösterilir.
 */
export const fetchDeviceWorkStatus = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
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
  }> => {
    return await runFetchDeviceWorkStatus(ctx, args);
  },
});

/**
 * Tek cihaz için AcsEvent backfill yapar.
 * - Sayfalı döngü: searchResultPosition += numMatches, total'a kadar veya maxPages.
 * - Her event → backfillHikEventRow (dedup korumalı).
 * - En yüksek serialNo → setHikBackfillProgress (hikLastSerialNo'ya DOKUNMAZ).
 */
export const backfillDeviceEvents = authedAction({
  args: {
    deviceId: v.id("devices"),
    startTime: v.optional(v.string()),
    maxPages: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    scanned: number;
    inserted: number;
    skipped: number;
    cursor?: number;
    error?: string;
  }> => {
    return await runBackfillDeviceEvents(ctx, args);
  },
});

/**
 * Tüm online gateway cihazlar için backfill çalıştırır.
 * Cron tarafından günlük 02:00 UTC'de tetiklenir.
 * İlk çalışmada cursor yoksa son 48 saati backfill eder.
 */
export const backfillAllDevicesEvents = internalAction({
  args: {},
  handler: async (ctx): Promise<{ devices: number; errors: string[] }> => {
    return await runBackfillAllDevicesEvents(ctx);
  },
});

// ---------------------------------------------------------------------------
// PR3: Reconcile + canlı kart/yüz okuma action'ları
// ---------------------------------------------------------------------------

/**
 * Cihazın kart rosteriyle DB'deki beklenen roster'ı karşılaştırır.
 * RAPOR MODU — silme/ekleme YAPMAZ.
 *
 * Beklenen roster: cihaza yetkili tüm çalışanların cardNumber'ları.
 * Yetki zinciri: groupDevices.deviceId=cihaz VEYA doors.deviceId=cihaz → groupDoors
 *   → aktif accessRules → groupMembers → employees.cardNumber
 * (internal.devices.getHikAuthorizedCardNumbers)
 *
 * Cihaz roster: searchCardsOnDevice ile TÜM sayfalar gezilir.
 *
 * diffIds(expectedCards, onDeviceCards) → { removed=onDeviceNotExpected, added=expectedNotOnDevice }
 */
export const reconcileDevice = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    // Kart diff
    expectedCount: number;
    onDeviceCount: number;
    onDeviceNotExpected: string[];
    expectedNotOnDevice: string[];
    // Yüz diff
    faceExpectedCount: number;
    faceOnDeviceCount: number;
    faceOnDeviceNotExpected: string[];
    faceExpectedNotOnDevice: string[];
    // Parmak izi diff
    fingerprintExpectedCount: number;
    fingerprintOnDeviceCount: number;
    fingerprintOnDeviceNotExpected: string[];
    fingerprintExpectedNotOnDevice: string[];
    error?: string;
  }> => {
    return await runReconcileDevice(ctx, args);
  },
});

/**
 * Okuyucudan canlı kart okutma işlemi başlatır.
 * GET /ISAPI/AccessControl/CaptureCardInfo
 * Dönüş: { ok, cardNo?, error? }
 */
export const captureCardFromDevice = authedAction({
  args: { deviceId: v.id("devices") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; cardNo?: string; error?: string }> => {
    return await runCaptureCardFromDevice(ctx, args);
  },
});

/**
 * Okuyucudan canlı yüz verisi alır.
 * POST /ISAPI/AccessControl/CaptureFaceData (+ progress poll)
 * Dönüş: { ok, faceDataBase64?, faceURL?, error? }
 *
 * employeeId verilirse çalışanın kart numarası employeeNo olarak cihaza iletilir.
 */
export const captureFaceFromDevice = authedAction({
  args: {
    deviceId: v.id("devices"),
    employeeId: v.optional(v.id("employees")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; faceDataBase64?: string; faceURL?: string; error?: string }> => {
    return await runCaptureFaceFromDevice(ctx, args);
  },
});

// ============================================================================
// DOOR STATUS PLAN + VERIFY PLAN — Faz 5 (PR4)
// ============================================================================

/**
 * Kapıya DoorStatus planı uygular.
 * Plan kaynağı: door.hikDoorStatusPlan. enabled=false ise planı iptal eder.
 *
 * planNo / templateNo konvansiyonu: kapı-tabanlı sabit slot.
 *   planNo     = (hikDoorNo ?? 1)
 *   templateNo = (hikDoorNo ?? 1) + 100  (template slotları ayrı namespace'e alınır)
 * Bu konvansiyonla her kapı kendi planNo/templateNo slot'una yazar; çakışma olmaz.
 * Cihazda yalnız bir kapı varsa her zaman planNo=1, templateNo=101 olur.
 */
export const applyDoorStatusPlan = authedAction({
  args: { doorId: v.id("doors") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
    return await runApplyDoorStatusPlan(ctx, args);
  },
});

export const fetchReaderCfg = authedAction({
  args: { readerId: v.id("readers") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; snapshot?: HikCardReaderSnapshot; error?: string }> => {
    return await runFetchReaderCfg(ctx, args);
  },
});

/**
 * Kapıya Verify planı uygular.
 * Plan kaynağı: door.hikVerifyPlan. enabled=false ise planı iptal eder.
 *
 * planNo / templateNo konvansiyonu: applyDoorStatusPlan ile aynı slot kuralı ama
 * ayrı ISAPI endpoint'leri (VerifyWeekPlanCfg / VerifyPlanTemplate / VerifyPlan).
 * Çakışma yok — DoorStatus ve Verify plan numaraları ayrı cihaz-tarafı havuzlarda tutuluyor.
 */
export const applyVerifyPlan = authedAction({
  args: { doorId: v.id("doors") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
    return await runApplyVerifyPlan(ctx, args);
  },
});
