"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  upsertPersonToDevice,
  addCardToDevice,
  deletePersonFromDevice,
  deleteCardFromDevice,
  deleteFaceFromDevice,
  addFingerprintToDevice,
  deleteFingerprintFromDevice,
  setWeekPlanOnDevice,
  setDoorParam,
  openDoor,
} from "../lib/hikGateway";
import { defaultRuleSchedule } from "../lib/hikSync";

/**
 * Failed sync ops için retry worker.
 *
 * Her 1 dakikada bir çalışır:
 * 1. status=failed olan ops'ları çek (attemptCount<5, deviceId online).
 * 2. Operation tipine göre uygun gateway helper'ını çağır.
 * 3. Başarı → status=done; başarısızlık → attemptCount++ + lastError güncelle,
 *    attemptCount>=5 ise terminal failed bırak.
 *
 * "Online" tanımı: device.hikLastSeenAt son 5 dakikada güncellenmiş.
 * Offline cihazlara hiç deneme yapılmaz — bir sonraki tick'te kontrol edilir.
 *
 * Phase 5 backfill (AcsEvent history) bu worker'a sonra eklenecek.
 */

const HIK_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

export const processHikQueue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ retried: number; ok: number; failed: number }> => {
    const candidates = await ctx.runQuery(
      internal.hikvisionSync.listRetryCandidates,
      { limit: BATCH_SIZE, maxAttempts: MAX_ATTEMPTS, onlineWindowMs: HIK_ONLINE_WINDOW_MS },
    );

    if (candidates.length === 0) {
      return { retried: 0, ok: 0, failed: 0 };
    }

    const results = await Promise.all(
      candidates.map(async (c) => {
        const r = await executeOperation(ctx, c);
        return { id: c._id, ok: r.ok, error: r.error };
      }),
    );

    let okCount = 0;
    let failedCount = 0;
    const writes: Promise<unknown>[] = [];
    for (const r of results) {
      if (r.ok) {
        okCount++;
        writes.push(
          ctx.runMutation(internal.hikvisionSync.markOpDone, { id: r.id }),
        );
      } else {
        failedCount++;
        writes.push(
          ctx.runMutation(internal.hikvisionSync.markOpRetried, {
            id: r.id,
            lastError: r.error ?? "Bilinmeyen hata",
          }),
        );
      }
    }
    await Promise.all(writes);
    return { retried: candidates.length, ok: okCount, failed: failedCount };
  },
});

type Candidate = FunctionReturnType<typeof internal.hikvisionSync.listRetryCandidates>[number];

/**
 * Tek bir kuyruk kaydını gerçekleştir — payload + operation tipine göre uygun helper.
 * Buraya yeni op tipi eklemek için: 1) schema enum, 2) hikvisionSync action,
 * 3) burada `case` ekle.
 */
async function executeOperation(
  ctx: unknown,
  c: Candidate,
): Promise<{ ok: boolean; error?: string }> {
  void ctx;
  const devIndex = c.device.hikDevIndex;
  if (!devIndex) return { ok: false, error: "Cihaz gateway'e kayıtlı değil" };

  const payload = (c.payload ?? {}) as Record<string, unknown>;

  switch (c.operation) {
    case "addPerson":
    case "updatePerson": {
      const employee = c.employee;
      if (!employee?.cardNumber) return { ok: false, error: "Çalışan veya kart numarası yok" };
      const planTemplateNo = payload.planTemplateNo;
      if (typeof planTemplateNo !== "number") {
        return {
          ok: false,
          error:
            "planTemplateNo eksik — bu kişiyi tekrar push'lamak için Erişim Yönetimi → Cihazlara Push Et",
        };
      }
      return await upsertPersonToDevice(devIndex, {
        employeeNo: employee.cardNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        planTemplateNo,
        doorCount: c.device.hikDoorCount,
      });
    }
    case "deletePerson": {
      const employee = c.employee;
      if (!employee?.cardNumber) return { ok: false, error: "Çalışan veya kart numarası yok" };
      return await deletePersonFromDevice(devIndex, employee.cardNumber);
    }
    case "addCard": {
      const employee = c.employee;
      if (!employee?.cardNumber) return { ok: false, error: "Çalışan veya kart numarası yok" };
      const r = await addCardToDevice(devIndex, {
        employeeNo: employee.cardNumber,
        cardNo: employee.cardNumber,
        cardType: "normalCard",
      });
      // alreadyExists idempotent kabul.
      if (r.alreadyExists) return { ok: true };
      return r;
    }
    case "deleteCard": {
      const cardNo = (payload.cardNumber ?? c.employee?.cardNumber) as string | undefined;
      if (!cardNo) return { ok: false, error: "Kart numarası yok" };
      return await deleteCardFromDevice(devIndex, cardNo);
    }
    case "deleteFace": {
      const employeeNo = c.employee?.cardNumber;
      if (!employeeNo) return { ok: false, error: "Çalışan veya kart numarası yok" };
      return await deleteFaceFromDevice(devIndex, employeeNo);
    }
    case "addFingerprint": {
      const employeeNo = c.employee?.cardNumber;
      const fingerPrintID = payload.fingerPrintID as number | undefined;
      const fp = c.fingerprint;
      if (!employeeNo || !fingerPrintID || !fp) {
        return { ok: false, error: "Fingerprint verileri eksik" };
      }
      return await addFingerprintToDevice(devIndex, {
        employeeNo,
        fingerPrintID,
        fingerData: fp.fingerData,
        fingerType: (fp.fingerType as "normalFP" | undefined) ?? "normalFP",
      });
    }
    case "deleteFingerprint": {
      const employeeNo = c.employee?.cardNumber;
      const fingerPrintID = payload.fingerPrintID as number | undefined;
      if (!employeeNo) return { ok: false, error: "Çalışan veya kart numarası yok" };
      return await deleteFingerprintFromDevice(devIndex, employeeNo, fingerPrintID);
    }
    case "syncWeekPlan": {
      const rule = c.accessRule;
      const weekPlanNo = (payload.weekPlanNo as number | undefined) ?? rule?.hikWeekPlanNo;
      if (!rule || !weekPlanNo) {
        return { ok: false, error: "Kural veya weekPlanNo eksik" };
      }
      // Saat/gün eksikse defaultRuleSchedule 7/24 fallback uygular.
      const schedule = defaultRuleSchedule(rule);
      return await setWeekPlanOnDevice(devIndex, weekPlanNo, schedule);
    }
    case "syncDoorParam": {
      const doorNo = (payload.doorNo as number | undefined) ?? 1;
      const param = (payload.param as Record<string, unknown> | undefined) ?? {};
      return await setDoorParam(devIndex, doorNo, {
        openDuration: param.openDuration as number | undefined,
        magneticAlarmEnable: param.magneticAlarmEnable as boolean | undefined,
        doorTimeoutAlarm: param.doorTimeoutAlarm as number | undefined,
      });
    }
    case "openDoor": {
      const doorNo = (payload.doorNo as number | undefined) ?? 1;
      return await openDoor(devIndex, doorNo);
    }
    // addFace + syncHoliday: retry yolu şimdilik desteklenmiyor (binary upload + tatil planı UI'sı yok).
    default:
      return {
        ok: false,
        error: `Worker bu op tipini desteklemiyor: ${c.operation}`,
      };
  }
}

