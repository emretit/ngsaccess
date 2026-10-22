"use node";

import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { isProjectAllowed, isManager } from "./auth";
import type { Doc, Id } from "../_generated/dataModel";
import { searchAcsEventsOnDevice } from "./hikGateway";
import { auditDeviceCommand } from "./gatewayCommand";

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

const DEFAULT_BACKFILL_MAX_PAGES = 50;

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

  return { employees: empIds.length, rules: ruleIds.length };
}

export async function runBackfillDeviceEvents(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices">; startTime?: string; maxPages?: number }
): Promise<{
    ok: boolean;
    scanned: number;
    inserted: number;
    skipped: number;
    cursor?: number;
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
  if (!isManager(ctx.user)) {
    return { ok: false, scanned: 0, inserted: 0, skipped: 0, error: "Bu işlem için yönetici yetkisi gerekiyor" };
  }
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
      error?: string;
  }> => {
    return await _runBackfill(ctx, {
      deviceId: args.deviceId,
      devIndex: devIndex,
      startTime: args.startTime,
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
