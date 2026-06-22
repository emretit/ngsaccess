"use node";

import { internal } from "../_generated/api";
import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { authedAction } from "../lib/customFunctions";
import { isProjectAllowed } from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import {
  addDeviceToGateway,
  captureCardOnDevice,
  captureFaceOnDevice,
  deleteDeviceFromGateway,
  getDoorCapabilities,
  getAcsWorkStatus,
  listGatewayDevices,
  linkDoorStatusPlan,
  linkVerifyPlan,
  openDoor,
  pingGateway,
  rebootDeviceOnGateway,
  searchAcsEventsOnDevice,
  searchCardsOnDevice,
  searchFacesOnDevice,
  searchFingerprintsOnDevice,
  setDeviceTime,
  setDoorStatusPlanTemplate,
  setDoorStatusWeekPlan,
  setHttpHostForwarding,
  setVerifyPlanTemplate,
  setVerifyWeekPlan,
  type FaceRecord,
  type FingerprintRecord,
  type SearchCardInfo,
  type Weekday,
} from "../lib/hikGateway";
import { diffIds } from "../lib/reconcileMath";

type DrainPage = {
  ok: boolean;
  numMatches: number;
  nextPosition: number;
  hasMore: boolean;
  error?: string;
};

async function collectAllPages<TItem, TPage extends DrainPage>(opts: {
  label: string;
  deviceId: Id<"devices">;
  maxPages: number;
  loadPage: (position: number) => Promise<TPage>;
  itemsFromPage: (page: TPage) => TItem[];
}): Promise<{ ok: true; items: TItem[] } | { ok: false; items: TItem[]; error?: string }> {
  const items: TItem[] = [];
  let position = 0;
  let pageCount = 0;

  while (pageCount < opts.maxPages) {
    const page = await opts.loadPage(position);
    if (!page.ok) {
      return { ok: false, items, error: page.error };
    }

    items.push(...opts.itemsFromPage(page));
    pageCount++;
    if (page.numMatches === 0 || !page.hasMore) break;
    position = page.nextPosition;
  }

  if (pageCount >= opts.maxPages) {
    console.warn(
      `[hik-reconcile] ${opts.label} maxPages=${opts.maxPages} aşıldı, device=${opts.deviceId}`,
    );
  }

  return { ok: true, items };
}

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
        ctx.runAction(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: id }),
      ),
    );
    await Promise.all(
      empIds.map((id) =>
        ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: id }),
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
    if (device.hikTransport === "localBridge") {
      await ctx.runMutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
        deviceId: device._id,
        projectId: device.projectId,
        operation: "openDoor",
        payload: { doorNo: args.doorNo ?? 1 },
      });
      return { ok: true };
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
    if (device.hikTransport !== "gateway") {
      return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return {
        ok: false,
        error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
      };
    }
    const result = await rebootDeviceOnGateway(device.hikDevIndex);
    if (result.ok) {
      await ctx.runMutation(internal.devices.setHikLastRebootAt, {
        deviceId: args.deviceId,
        at: Date.now(),
      });
    }
    return result;
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
    if (device.hikTransport !== "gateway") {
      return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return {
        ok: false,
        error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)",
      };
    }
    const result = await getAcsWorkStatus(device.hikDevIndex);
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
  },
});

// ---------------------------------------------------------------------------
// AcsEvent backfill (PR2)
// ---------------------------------------------------------------------------

const DEFAULT_BACKFILL_MAX_PAGES = 50;

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
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const device = await ctx.runQuery(internal.devices.getByIdInternal, {
      id: args.deviceId,
    });
    if (!device) return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Cihaz bulunamadı" };
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Bu cihaza erişim yetkiniz yok" };
    }
    if (device.hikTransport !== "gateway") {
      return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Cihaz gateway'e kayıtlı değil" };
    }

    return await _runBackfill(ctx, {
      deviceId: args.deviceId,
      devIndex: device.hikDevIndex,
      startTime: args.startTime,
      maxPages: args.maxPages,
    });
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
    const onlineDevices = await ctx.runQuery(
      internal.devices.listOnlineGatewayDevicesForBackfill,
      {},
    );

    const errors: string[] = [];
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    for (const dev of onlineDevices) {
      try {
        // Son backfill zamanından 5dk overlap ile devam et; hiç çalışmadıysa 48 saati al.
        // Not: hikBackfillCursor serial-no bilgisi taşır (filtreleme için KULLANILMAZ),
        // zaman-penceresi hikLastBackfillAt üzerinden yönetilir.
        const startTime = dev.hikLastBackfillAt
          ? new Date(dev.hikLastBackfillAt - 5 * 60 * 1000).toISOString()
          : fortyEightHoursAgo;
        const result = await _runBackfill(ctx, {
          deviceId: dev._id,
          devIndex: dev.hikDevIndex,
          startTime,
          maxPages: DEFAULT_BACKFILL_MAX_PAGES,
        });
        if (!result.ok) {
          errors.push(`${dev._id}: ${result.error ?? "bilinmeyen hata"}`);
        }
      } catch (e) {
        errors.push(`${dev._id}: ${(e as Error).message}`);
      }
    }

    return { devices: onlineDevices.length, errors };
  },
});

/**
 * Backfill döngüsü — hem authed action hem internal cron tarafından kullanılır.
 */
async function _runBackfill(
  ctx: ActionCtx,
  opts: {
    deviceId: Id<"devices">;
    devIndex: string;
    startTime?: string;
    maxPages?: number;
  },
): Promise<{
  ok: boolean;
  scanned: number;
  inserted: number;
  skipped: number;
  cursor?: number;
  error?: string;
}> {
  const maxPages = opts.maxPages ?? DEFAULT_BACKFILL_MAX_PAGES;
  const searchID = `backfill-${opts.deviceId}-${Date.now()}`;

  let position = 0;
  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  let maxSerialNo: number | undefined = undefined;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const page = await searchAcsEventsOnDevice(opts.devIndex, {
      searchID,
      position,
      maxResults: 30,
      ...(opts.startTime ? { startTime: opts.startTime } : {}),
    });

    if (!page.ok) {
      return { ok: false, scanned, inserted, skipped, error: page.error };
    }

    for (const event of page.events) {
      scanned++;
      // serialNo garantili (searchAcsEventsOnDevice parse ederken kontrol eder)
      const result: { inserted: boolean; reason?: string } = await ctx.runMutation(
        internal.cardReadings.backfillHikEventRow,
        { deviceId: opts.deviceId, event },
      );
      if (result.inserted) {
        inserted++;
        if (maxSerialNo === undefined || event.serialNo > maxSerialNo) {
          maxSerialNo = event.serialNo;
        }
      } else {
        skipped++;
      }
    }

    pageCount++;

    // hasMore=false → cihaz "daha yok" dedi (responseStatusStrg!=="MORE" ve tam-dolu sayfa değil)
    // numMatches===0 → boş sayfa (döngü sonu guard)
    if (page.numMatches === 0 || !page.hasMore) {
      break;
    }
    position = page.nextPosition;
  }

  if (pageCount >= maxPages) {
    console.warn(
      `[hik-backfill] maxPages=${maxPages} aşıldı, device=${opts.deviceId}, position=${position}`,
    );
  }

  // Cursor güncelle
  await ctx.runMutation(internal.devices.setHikBackfillProgress, {
    deviceId: opts.deviceId,
    cursor: maxSerialNo,
    at: Date.now(),
  });

  return { ok: true, scanned, inserted, skipped, cursor: maxSerialNo };
}

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
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const device = await ctx.runQuery(internal.devices.getByIdInternal, {
      id: args.deviceId,
    });
    /** Boş diff — hata dönüşleri için sıfır-değer helper. */
    const emptyDiff = () => ({
      expectedCount: 0,
      onDeviceCount: 0,
      onDeviceNotExpected: [] as string[],
      expectedNotOnDevice: [] as string[],
      faceExpectedCount: 0,
      faceOnDeviceCount: 0,
      faceOnDeviceNotExpected: [] as string[],
      faceExpectedNotOnDevice: [] as string[],
      fingerprintExpectedCount: 0,
      fingerprintOnDeviceCount: 0,
      fingerprintOnDeviceNotExpected: [] as string[],
      fingerprintExpectedNotOnDevice: [] as string[],
    });

    if (!device) {
      return { ok: false, ...emptyDiff(), error: "Cihaz bulunamadı" };
    }
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      return { ok: false, ...emptyDiff(), error: "Bu cihaza erişim yetkiniz yok" };
    }
    if (device.hikTransport !== "gateway") {
      return { ok: false, ...emptyDiff(), error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return { ok: false, ...emptyDiff(), error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
    }
    const devIndex = device.hikDevIndex;

    // ── Beklenen roster'lar ─────────────────────────────────────────────────
    const [expectedCards, expectedFaces, expectedFingerprints] = await Promise.all([
      ctx.runQuery(internal.devices.getHikAuthorizedCardNumbers, { deviceId: args.deviceId }) as Promise<string[]>,
      ctx.runQuery(internal.devices.getHikDeviceFaceRoster, { deviceId: args.deviceId }) as Promise<string[]>,
      ctx.runQuery(internal.devices.getHikDeviceFingerprintRoster, { deviceId: args.deviceId }) as Promise<string[]>,
    ]);

    const MAX_RECONCILE_PAGES = 100;
    const now = Date.now();
    const [cardDrain, faceDrain, fingerprintDrain] = await Promise.all([
      collectAllPages<string, {
        ok: boolean;
        cards: SearchCardInfo[];
        numMatches: number;
        nextPosition: number;
        hasMore: boolean;
        error?: string;
      }>({
        label: "kart",
        deviceId: args.deviceId,
        maxPages: MAX_RECONCILE_PAGES,
        loadPage: (position) =>
          searchCardsOnDevice(devIndex, {
            searchID: `reconcile-card-${args.deviceId}-${now}`,
            position,
            maxResults: 50,
          }),
        itemsFromPage: (page) => page.cards.map((card) => card.cardNo),
      }),
      collectAllPages<string, {
        ok: boolean;
        faces: FaceRecord[];
        numMatches: number;
        nextPosition: number;
        hasMore: boolean;
        error?: string;
      }>({
        label: "yüz",
        deviceId: args.deviceId,
        maxPages: MAX_RECONCILE_PAGES,
        loadPage: (position) =>
          searchFacesOnDevice(devIndex, {
            searchID: `reconcile-face-${args.deviceId}-${now}`,
            position,
            maxResults: 50,
          }),
        itemsFromPage: (page) =>
          page.faces.flatMap((face) => {
            // VERIFY: cihazdaki yüz kaydında employeeNo mu yoksa FPID mi kullanılan tanımlayıcı?
            // hikvisionSync.ts addFaceToDevice'de FPID: employeeNo set ediliyor → employeeNo öncelikli.
            const id = face.employeeNo ?? face.FPID;
            return id ? [id] : [];
          }),
      }),
      collectAllPages<string, {
        ok: boolean;
        fingerprints: FingerprintRecord[];
        numMatches: number;
        nextPosition: number;
        hasMore: boolean;
        error?: string;
      }>({
        label: "parmak izi",
        deviceId: args.deviceId,
        maxPages: MAX_RECONCILE_PAGES,
        loadPage: (position) =>
          searchFingerprintsOnDevice(devIndex, {
            searchID: `reconcile-fp-${args.deviceId}-${now}`,
            position,
            maxResults: 50,
          }),
        itemsFromPage: (page) => page.fingerprints.map((fp) => fp.employeeNo),
      }),
    ]);

    if (!cardDrain.ok) {
      return {
        ok: false,
        ...emptyDiff(),
        expectedCount: expectedCards.length,
        error: `Cihaz kart listesi alınamadı: ${cardDrain.error ?? "bilinmeyen hata"}`,
      };
    }
    if (!faceDrain.ok) {
      // Yüz desteği olmayan cihazlar HTTP 4xx dönebilir — uyarı logla, kart sonucunu yine de dön.
      console.warn(`[hik-reconcile] yüz listesi alınamadı, device=${args.deviceId}: ${faceDrain.error ?? "?"}`);
    }
    if (!fingerprintDrain.ok) {
      console.warn(`[hik-reconcile] parmak izi listesi alınamadı, device=${args.deviceId}: ${fingerprintDrain.error ?? "?"}`);
    }

    const onDeviceCards = cardDrain.items;
    const onDeviceFaces = faceDrain.items;
    const onDeviceFingerprints = fingerprintDrain.items;

    // ── Farkları hesapla ────────────────────────────────────────────────────
    // diffIds(oldIds=expected, newIds=onDevice)
    //   removed = expected'da var ama cihazda yok = expectedNotOnDevice
    //   added   = cihazda var ama expected'da yok = onDeviceNotExpected
    const cardDiff = diffIds(expectedCards, onDeviceCards);
    const faceDiff = diffIds(expectedFaces, onDeviceFaces);
    const fingerprintDiff = diffIds(expectedFingerprints, onDeviceFingerprints);

    return {
      ok: true,
      // Kart
      expectedCount: expectedCards.length,
      onDeviceCount: onDeviceCards.length,
      onDeviceNotExpected: cardDiff.added,
      expectedNotOnDevice: cardDiff.removed,
      // Yüz
      faceExpectedCount: expectedFaces.length,
      faceOnDeviceCount: onDeviceFaces.length,
      faceOnDeviceNotExpected: faceDiff.added,
      faceExpectedNotOnDevice: faceDiff.removed,
      // Parmak izi
      fingerprintExpectedCount: expectedFingerprints.length,
      fingerprintOnDeviceCount: onDeviceFingerprints.length,
      fingerprintOnDeviceNotExpected: fingerprintDiff.added,
      fingerprintExpectedNotOnDevice: fingerprintDiff.removed,
    };
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
    if (device.hikTransport !== "gateway") {
      return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return { ok: false, error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
    }
    const result = await captureCardOnDevice(device.hikDevIndex);
    return { ok: result.ok, cardNo: result.cardNo, error: result.error };
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
    if (device.hikTransport !== "gateway") {
      return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return { ok: false, error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
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
      if (employee.projectId && !isProjectAllowed(allowedProjectIds, employee.projectId)) {
        return { ok: false, error: "Bu çalışana erişim yetkiniz yok" };
      }
      employeeNo = employee.cardNumber?.trim() ?? undefined;
    }

    const result = await captureFaceOnDevice(device.hikDevIndex, { employeeNo });
    return {
      ok: result.ok,
      faceDataBase64: result.faceDataBase64,
      faceURL: result.faceURL,
      error: result.error,
    };
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
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const door = await ctx.runQuery(internal.doors.getByIdInternal, { id: args.doorId });
    if (!door) return { ok: false, error: "Kapı bulunamadı" };
    if (!door.deviceId) return { ok: false, error: "Kapıya bağlı cihaz yok" };

    const device = await ctx.runQuery(internal.devices.getByIdInternal, { id: door.deviceId });
    if (!device) return { ok: false, error: "Cihaz bulunamadı" };
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
    }
    if (device.hikTransport !== "gateway") {
      return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return { ok: false, error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
    }

    const devIndex = device.hikDevIndex;

    // hikDoorNo tanımsızsa sessiz ?‌? 1 kullanma — aynı cihazda iki kapı slot 1'de çakışır.
    if (door.hikDoorNo === undefined || door.hikDoorNo === null) {
      return { ok: false, error: "Kapı numarası (hikDoorNo) tanımsız — kapıyı düzenleyip numara girin" };
    }
    const doorNo = door.hikDoorNo;
    const planNo = doorNo;
    const templateNo = doorNo + 100;
    const plan = door.hikDoorStatusPlan;

    // enabled=false veya plan yoksa iptal et
    if (!plan || !plan.enabled) {
      return await linkDoorStatusPlan(devIndex, doorNo, 0);
    }

    // Her gün aynı segment (basit tek-aralık plan)
    const ALL_WEEKDAYS: Weekday[] = [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ];
    const segments = ALL_WEEKDAYS.map((week, idx) => ({
      week,
      id: idx + 1,
      enable: true,
      doorStatus: plan.mode as "remainOpen" | "normal",
      beginTime: plan.beginTime,
      endTime: plan.endTime,
    }));

    const r1 = await setDoorStatusWeekPlan(devIndex, planNo, segments);
    if (!r1.ok) return r1;

    const r2 = await setDoorStatusPlanTemplate(devIndex, templateNo, { weekPlanNo: planNo });
    if (!r2.ok) return r2;

    return await linkDoorStatusPlan(devIndex, doorNo, templateNo);
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
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const door = await ctx.runQuery(internal.doors.getByIdInternal, { id: args.doorId });
    if (!door) return { ok: false, error: "Kapı bulunamadı" };
    if (!door.deviceId) return { ok: false, error: "Kapıya bağlı cihaz yok" };

    const device = await ctx.runQuery(internal.devices.getByIdInternal, { id: door.deviceId });
    if (!device) return { ok: false, error: "Cihaz bulunamadı" };
    if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
      return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
    }
    if (device.hikTransport !== "gateway") {
      return { ok: false, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
    }
    if (!device.hikDevIndex) {
      return { ok: false, error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
    }

    const devIndex = device.hikDevIndex;

    // hikDoorNo tanımsızsa sessiz ?‌? 1 kullanma — aynı cihazda iki kapı slot 1'de çakışır.
    if (door.hikDoorNo === undefined || door.hikDoorNo === null) {
      return { ok: false, error: "Kapı numarası (hikDoorNo) tanımsız — kapıyı düzenleyip numara girin" };
    }
    const doorNo = door.hikDoorNo;
    const planNo = doorNo;
    const templateNo = doorNo + 100;
    const plan = door.hikVerifyPlan;

    // enabled=false veya plan yoksa iptal et
    if (!plan || !plan.enabled) {
      return await linkVerifyPlan(devIndex, doorNo, 0);
    }

    const ALL_WEEKDAYS: Weekday[] = [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ];
    const segments = ALL_WEEKDAYS.map((week, idx) => ({
      week,
      id: idx + 1,
      enable: true,
      verifyMode: plan.verifyMode,
      beginTime: plan.beginTime,
      endTime: plan.endTime,
    }));

    const r1 = await setVerifyWeekPlan(devIndex, planNo, segments);
    if (!r1.ok) return r1;

    const r2 = await setVerifyPlanTemplate(devIndex, templateNo, { weekPlanNo: planNo });
    if (!r2.ok) return r2;

    return await linkVerifyPlan(devIndex, doorNo, templateNo);
  },
});
