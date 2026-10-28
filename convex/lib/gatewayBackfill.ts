"use node";

import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { isProjectAllowed } from "./auth";
import type { Doc, Id } from "../_generated/dataModel";
import { searchAcsEventsOnDevice } from "./hikGateway";
import { auditDeviceCommand } from "./gatewayCommand";

type BackfillContinuation = {
  deviceId: Id<"devices">;
  devIndex: string;
  searchID: string;
  position: number;
  startedAt: number;
  maxPages: number;
  startTime?: string;
  lastEventAt?: number;
  maxSerialNo?: number;
  observedSerialNo?: number;
  hop?: number;
};

async function _runBackfill(
  ctx: ActionCtx,
  opts: {
    deviceId: Id<"devices">;
    devIndex: string;
    startTime?: string;
    maxPages?: number;
    continuation?: BackfillContinuation;
    progressAt?: number;
  },
): Promise<{
  ok: boolean;
  scanned: number;
  inserted: number;
  skipped: number;
  cursor?: number;
  partial?: boolean;
  error?: string;
}> {
  const requestedPages = opts.maxPages ?? DEFAULT_BACKFILL_MAX_PAGES;
  const maxPages = Number.isFinite(requestedPages)
    ? Math.min(DEFAULT_BACKFILL_MAX_PAGES, Math.max(1, Math.floor(requestedPages)))
    : DEFAULT_BACKFILL_MAX_PAGES;
  const startedAt = opts.continuation?.startedAt ?? Date.now();
  const searchID = opts.continuation?.searchID ?? `backfill-${opts.deviceId}-${startedAt}`;

  const hop = opts.continuation?.hop ?? 1;
  let observedSerialNo = opts.continuation?.observedSerialNo;
  let stoppedReason: string | undefined;
  let position = opts.continuation?.position ?? 0;
  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  let maxSerialNo: number | undefined = opts.continuation?.maxSerialNo;
  let lastEventAt = opts.continuation?.lastEventAt;
  let pageCount = 0;
  let hasMore = false;

  while (pageCount < maxPages) {
    const page = await searchAcsEventsOnDevice(opts.devIndex, {
      searchID,
      position,
      maxResults: 30,
      ...(opts.startTime ? { startTime: opts.startTime } : {}),
      endTime: new Date(startedAt).toISOString(),
    });

    if (!page.ok) {
      return { ok: false, scanned, inserted, skipped, error: page.error };
    }

    const pageSerialNo = page.events.reduce<number | undefined>((max, event) =>
      max === undefined ? event.serialNo : Math.max(max, event.serialNo), undefined);
    const pageEventAt = page.events.reduce<number | undefined>((max, event) => {
      const at = Date.parse(event.time);
      return Number.isFinite(at) ? Math.max(max ?? at, at) : max;
    }, undefined);
    if (page.hasMore && (page.nextPosition <= position ||
        (observedSerialNo !== undefined && pageSerialNo !== undefined && pageSerialNo <= observedSerialNo &&
          (pageEventAt === undefined || (lastEventAt !== undefined && pageEventAt <= lastEventAt))))) {
      hasMore = true;
      stoppedReason = "Cihazın olay imleci ilerlemediği için tarama durduruldu. Cihazı kontrol edip taramayı yeniden başlatın.";
      break;
    }
    if (pageSerialNo !== undefined) observedSerialNo = Math.max(observedSerialNo ?? pageSerialNo, pageSerialNo);

    for (const event of page.events) {
      scanned++;
      // serialNo garantili (searchAcsEventsOnDevice parse ederken kontrol eder)
      const result: { inserted: boolean; reason?: string } = await ctx.runMutation(
        internal.cardReadings.backfillHikEventRow,
        { deviceId: opts.deviceId, event },
      );
      const eventAt = Date.parse(event.time);
      if (Number.isFinite(eventAt)) lastEventAt = Math.max(lastEventAt ?? eventAt, eventAt);
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
    hasMore = page.hasMore && page.numMatches > 0;

    // hasMore=false → cihaz "daha yok" dedi (responseStatusStrg!=="MORE" ve tam-dolu sayfa değil)
    // numMatches===0 → boş sayfa (döngü sonu guard)
    if (page.numMatches === 0 || !page.hasMore) {
      break;
    }
    position = page.nextPosition;
  }

  if (hasMore) {
    const canContinue = stoppedReason === undefined && hop < MAX_BACKFILL_CHAIN_RUNS;
    const error = stoppedReason ?? (canContinue
      ? "Olay taraması kısmen tamamlandı; kalan olaylar için devam işi planlandı. Cihazın tarama durumunu kontrol edin."
      : "Olay taraması kısmen tamamlandı; toplam tarama sınırına ulaşıldı. Kalan olaylar için daha dar bir tarih aralığıyla yeniden tarayın.");
    console.warn(`[hik-backfill] ${error} device=${opts.deviceId}, position=${position}`);
    // The continuation keeps the exact search and position, including when many
    // events share one timestamp. Never stamp an unfinished window with now.
    if (lastEventAt !== undefined) {
      await ctx.runMutation(internal.devices.setHikBackfillProgress, {
        deviceId: opts.deviceId, cursor: maxSerialNo, at: Math.max(opts.progressAt ?? lastEventAt, lastEventAt),
      });
    }
    if (canContinue) await ctx.scheduler.runAfter(0, internal.actions.hikQueueWorker.continueHikBackfill, {
      deviceId: opts.deviceId, devIndex: opts.devIndex, searchID, position,
      startedAt, maxPages, hop: hop + 1,
      ...(observedSerialNo !== undefined ? { observedSerialNo } : {}),
      ...(opts.startTime ? { startTime: opts.startTime } : {}),
      ...(lastEventAt !== undefined ? { lastEventAt } : {}),
      ...(maxSerialNo !== undefined ? { maxSerialNo } : {}),
    });
    return { ok: false, partial: true, scanned, inserted, skipped, cursor: maxSerialNo, error };
  }

  await ctx.runMutation(internal.devices.setHikBackfillProgress, {
    deviceId: opts.deviceId,
    cursor: maxSerialNo,
    at: Math.max(opts.progressAt ?? startedAt, startedAt),
  });

  return { ok: true, scanned, inserted, skipped, cursor: maxSerialNo };
}

/** Only the internal scheduler can supply an exact continuation position. */
export async function runBackfillContinuation(ctx: ActionCtx, args: BackfillContinuation): Promise<void> {
  const device = await ctx.runQuery(internal.devices.getByIdInternal, { id: args.deviceId });
  if (!device || device.brand !== "hikvision" || device.hikTransport === "localBridge" || device.hikDevIndex !== args.devIndex) {
    throw new Error("Tarama sürdürülemedi: cihazın gateway bağlantısı değişti. Cihaz sayfasından olay taramasını yeniden başlatın.");
  }
  if ((args.hop ?? 1) > MAX_BACKFILL_CHAIN_RUNS) {
    console.warn("[hik-backfill] Toplam tarama sınırı aşıldı; cihaz sayfasından taramayı yeniden başlatın.");
    return;
  }
  const result = await _runBackfill(ctx, { ...args, continuation: args, progressAt: device.hikLastBackfillAt });
  if (!result.ok && !result.partial) throw new Error(result.error ?? "Olay taraması sürdürülemedi; cihaz bağlantısını kontrol edin.");
}

const DEFAULT_BACKFILL_MAX_PAGES = 50;
const MAX_BACKFILL_CHAIN_RUNS = 10;

export async function runBackfillDeviceFromGroups(
  ctx: ActionCtx,
  args: { deviceId: Id<"devices"> }
): Promise<{ employees: number; rules: number }> {
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

  // Kayıt sonrası cihazdaki ngsplus dışı kişiler ASLA silinmez (Emre 2026-10-28):
  // sahada çalışan cihazın yerel kişileri korunur.
  return { employees: empIds.length, rules: ruleIds.length };
}

export async function runBackfillDeviceEvents(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices">; startTime?: string; maxPages?: number; fromAll?: boolean }
): Promise<{
    ok: boolean;
    scanned: number;
    inserted: number;
    skipped: number;
    cursor?: number;
    partial?: boolean;
    error?: string;
  }> {
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
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission: "devices.manage" });
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  if (device.hikTransport !== "gateway") {
    return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Cihaz gateway'e kayıtlı değil" };
  }

  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Olayları tara", async (): Promise<{
      ok: boolean;
      scanned: number;
      inserted: number;
      skipped: number;
      cursor?: number;
    partial?: boolean;
      error?: string;
  }> => {
    return await _runBackfill(ctx, {
      deviceId: args.deviceId,
      devIndex: devIndex,
      startTime: args.fromAll ? "2000-01-01T00:00:00+03:00" : args.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      progressAt: device.hikLastBackfillAt,
      maxPages: args.maxPages,
    });
  });
}

export async function runBackfillAllDevicesEvents(
  ctx: ActionCtx
): Promise<{ devices: number; errors: string[] }> {
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
        progressAt: dev.hikLastBackfillAt,
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
}
