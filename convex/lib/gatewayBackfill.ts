"use node";

import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { isProjectAllowed } from "./auth";
import type { Doc, Id } from "../_generated/dataModel";
import { searchAcsEventsOnDevice } from "./hikGateway";
import { newHikSearchId } from "./gateway/core";
import type { HikBackfillPending } from "./gateway/backfillState";
import { auditDeviceCommand } from "./gatewayCommand";

type BackfillContinuation = HikBackfillPending & {
  deviceId: Id<"devices">;
  hop?: number;
};

const MAX_BACKFILL_FAILURES = 3;
const MAX_BACKFILL_AGE_MS = 6 * 60 * 60 * 1000;

function shouldRestart(pending: HikBackfillPending, failures = pending.failCount ?? 0): boolean {
  // Daily cron pauses are expected. Try a healthy cursor regardless of age;
  // only a failing search is stale, measured from its last fully imported page.
  return failures >= MAX_BACKFILL_FAILURES || (failures > 0 &&
    Date.now() - (pending.lastProgressAt ?? pending.startedAt) >= MAX_BACKFILL_AGE_MS);
}

function recoveryStartTime(completedAt: number | undefined, previousStart?: string): string {
  return completedAt !== undefined
    ? new Date(completedAt - 5 * 60 * 1000).toISOString()
    : previousStart ?? new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
}

function checkpointExpectation(pending: HikBackfillPending) {
  return { expectedSearchID: pending.searchID, expectedPosition: pending.position, expectedFailCount: pending.failCount ?? 0 };
}

async function _runBackfill(
  ctx: ActionCtx,
  opts: {
    deviceId: Id<"devices">;
    devIndex: string;
    startTime?: string;
    maxPages?: number;
    continuation?: BackfillContinuation;
    replacePending?: HikBackfillPending;
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
  const old = opts.continuation;
  const expired = old !== undefined && shouldRestart(old);
  const continuation = expired ? undefined : old;
  const replacePending = opts.replacePending ?? (expired ? old : undefined);
  const startedAt = continuation?.startedAt ?? Date.now();
  const startTime = expired ? recoveryStartTime(opts.progressAt, old?.startTime)
    : continuation ? continuation.startTime : opts.startTime;
  const searchID = continuation?.searchID ?? newHikSearchId();

  const hop = continuation?.hop ?? 1;
  let lastPageKey = continuation?.lastPageKey;
  let stoppedReason: string | undefined;
  let position = continuation?.position ?? 0;
  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  let maxSerialNo: number | undefined = continuation?.maxSerialNo;
  let lastEventAt = continuation?.lastEventAt;
  let lastProgressAt = continuation?.lastProgressAt;
  let failCount = continuation?.failCount ?? 0;
  let pageCount = 0;
  let hasMore = false;

  // Persist before the first request. A transport/validation/scheduler failure
  // leaves a checkpoint for the cron; repeated failures restart its search safely.
  const pending = (): HikBackfillPending => ({
    devIndex: opts.devIndex, searchID, position, startedAt, maxPages, failCount,
    ...(startTime ? { startTime } : {}),
    ...(lastPageKey ? { lastPageKey } : {}),
    ...(lastEventAt !== undefined ? { lastEventAt } : {}),
    ...(lastProgressAt !== undefined ? { lastProgressAt } : {}),
    ...(maxSerialNo !== undefined ? { maxSerialNo } : {}),
  });
  const conflict = () => ({ ok: false, partial: true, scanned, inserted, skipped,
    error: "Olay taraması başka bir işlemde ilerledi; sonraki taramada sürdürülecek." });
  if (!continuation) {
    const saved: boolean = await ctx.runMutation(internal.devices.setHikBackfillPending, {
      deviceId: opts.deviceId, pending: pending(),
      ...(replacePending ? { ...checkpointExpectation(replacePending), restart: true } : {}),
    });
    if (!saved) return conflict();
  }

  let committed = pending();
  const recordFailure = async (error: string, partial = false) => {
    const failures = (committed.failCount ?? 0) + 1;
    const restart = shouldRestart(committed, failures);
    // Keep the completed watermark untouched. The next cron resumes this fresh
    // search, replaying the overlap through the existing event deduplication.
    const next: HikBackfillPending = restart ? {
      devIndex: opts.devIndex, searchID: newHikSearchId(), position: 0,
      startedAt: Date.now(), maxPages, failCount: 0,
      startTime: recoveryStartTime(opts.progressAt, committed.startTime),
    } : { ...committed, failCount: failures };
    const saved: boolean = await ctx.runMutation(internal.devices.setHikBackfillPending, {
      deviceId: opts.deviceId, pending: next, ...checkpointExpectation(committed),
      ...(restart ? { restart: true } : {}),
    });
    if (!saved) return conflict();
    return { ok: false, scanned, inserted, skipped, ...(partial ? { partial: true } : {}), error };
  };

  try {
    while (pageCount < maxPages) {
      const page = await searchAcsEventsOnDevice(opts.devIndex, {
        searchID,
        position,
        maxResults: 30,
        ...(startTime ? { startTime } : {}),
        endTime: new Date(startedAt).toISOString(),
      });

      if (!page.ok) {
        return recordFailure(page.error ?? "Olay taraması tamamlanamadı.");
      }

      // Sonuçlar serial/zaman sırasında gelmeyebilir (DS-K1T804AMF olayları gruplayıp ikinci grupta
      // en eskiden yeniden başlar); imleç yalnız aynı sayfa tekrar dönünce takılı sayılır.
      const pageKey = page.events.map(event => event.serialNo).sort((a, b) => a - b).join(",");
      if (page.hasMore && (page.nextPosition <= position || (pageKey !== "" && pageKey === lastPageKey))) {
        hasMore = true;
        stoppedReason = "Cihazın olay taraması ilerlemediği için durduruldu. Tarama otomatik olarak yeniden denenecek.";
        break;
      }

      scanned += page.skipped ?? 0;
      skipped += page.skipped ?? 0;
      if (page.skipped) console.warn(`[hik-backfill] Geçersiz olay kayıtları atlandı: ${page.skipped} device=${opts.deviceId}, position=${position}`);
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

      lastPageKey = pageKey;
      position = page.nextPosition;
      failCount = 0;
      lastProgressAt = Date.now();
      // Commit only a fully imported page. Replaying a partially imported page is
      // safe because backfillHikEventRow deduplicates by device + serial number.
      const saved: boolean = await ctx.runMutation(internal.devices.setHikBackfillPending, {
        deviceId: opts.deviceId, pending: pending(),
        ...checkpointExpectation(committed),
      });
      if (!saved) return conflict();
      committed = pending();
      pageCount++;
      hasMore = page.hasMore && page.numMatches > 0;

      // hasMore=false → cihaz "daha yok" dedi (responseStatusStrg!=="MORE" ve tam-dolu sayfa değil)
      // numMatches===0 → boş sayfa (döngü sonu guard)
      if (page.numMatches === 0 || !page.hasMore) {
        break;
      }
    }

    if (hasMore) {
      const canContinue = stoppedReason === undefined && hop < MAX_BACKFILL_CHAIN_RUNS;
      const error = stoppedReason ?? (canContinue
        ? "Olay taraması kısmen tamamlandı; kalan olaylar için devam işi planlandı. Cihazın tarama durumunu kontrol edin."
        : "Olay taraması kısmen tamamlandı; toplam tarama sınırına ulaşıldı. Sonraki tarama kaldığı konumdan devam edecek.");
      console.warn(`[hik-backfill] ${error} device=${opts.deviceId}, position=${position}`);
      if (stoppedReason !== undefined) return recordFailure(error, true);
      // Completed time stays unchanged until every result group is exhausted.
      if (canContinue) await ctx.scheduler.runAfter(0, internal.actions.hikQueueWorker.continueHikBackfill, {
        deviceId: opts.deviceId, devIndex: opts.devIndex, searchID, position,
        startedAt, maxPages, hop: hop + 1, lastProgressAt,
        ...(lastPageKey ? { lastPageKey } : {}),
        ...(startTime ? { startTime } : {}),
        ...(lastEventAt !== undefined ? { lastEventAt } : {}),
        ...(maxSerialNo !== undefined ? { maxSerialNo } : {}),
      });
      return { ok: false, partial: true, scanned, inserted, skipped, cursor: maxSerialNo, error };
    }

    const completed: boolean = await ctx.runMutation(internal.devices.setHikBackfillProgress, {
      deviceId: opts.deviceId,
      cursor: maxSerialNo,
      searchID, position,
      at: Math.max(opts.progressAt ?? startedAt, startedAt),
    });

    if (!completed) return conflict();
    return { ok: true, scanned, inserted, skipped, cursor: maxSerialNo };
  } catch (error) {
    return recordFailure(error instanceof Error ? error.message : "Olay taraması tamamlanamadı.");
  }
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
  const pending = device.hikBackfillPending;
  // A delayed scheduler invocation must not rewind or resurrect completed work.
  if (pending && (pending.searchID !== args.searchID || pending.position !== args.position)) return;
  if (!pending && (device.hikLastBackfillAt ?? 0) >= args.startedAt) return;
  if (!pending) {
    const saved: boolean = await ctx.runMutation(internal.devices.setHikBackfillPending, {
      deviceId: args.deviceId, pending: {
        devIndex: args.devIndex, searchID: args.searchID, position: args.position,
        startedAt: args.startedAt, maxPages: args.maxPages,
        ...(args.lastProgressAt !== undefined ? { lastProgressAt: args.lastProgressAt } : {}),
        ...(args.startTime ? { startTime: args.startTime } : {}),
        ...(args.lastPageKey ? { lastPageKey: args.lastPageKey } : {}),
        ...(args.lastEventAt !== undefined ? { lastEventAt: args.lastEventAt } : {}),
        ...(args.maxSerialNo !== undefined ? { maxSerialNo: args.maxSerialNo } : {}),
      },
    });
    if (!saved) return;
  }
  const result = await _runBackfill(ctx, {
    ...args, continuation: { ...args, ...pending }, progressAt: device.hikLastBackfillAt,
  });
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
      maxPages: (args.fromAll || args.startTime !== undefined) ? args.maxPages : device.hikBackfillPending?.maxPages ?? args.maxPages,
      replacePending: (args.fromAll || args.startTime !== undefined) && device.hikBackfillPending?.devIndex === devIndex
        ? device.hikBackfillPending : undefined,
      continuation: !args.fromAll && args.startTime === undefined && device.hikBackfillPending?.devIndex === devIndex
        ? { ...device.hikBackfillPending, deviceId: args.deviceId } : undefined,
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
        maxPages: dev.hikBackfillPending?.maxPages ?? DEFAULT_BACKFILL_MAX_PAGES,
        continuation: dev.hikBackfillPending?.devIndex === dev.hikDevIndex
          ? { ...dev.hikBackfillPending, deviceId: dev._id } : undefined,
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
