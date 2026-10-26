"use node";

import { v } from "convex/values";
import { runBackfillContinuation } from "../lib/gatewayBackfill";
import { internalAction, type ActionCtx } from "../_generated/server";
import { sendStoredDoorStatusPlan, sendStoredVerifyPlan } from "../lib/gatewayCommand";
import { internal } from "../_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../_generated/dataModel";
import {
  upsertPersonToDevice,
  addCardToDevice,
  deletePersonFromDevice,
  deleteCardFromDevice,
  deleteFaceFromDevice,
  deleteFingerprintFromDevice,
  rebootDeviceOnGateway,
  setWeekPlanOnDevice,
  setDoorParam,
  openDoor,
} from "../lib/hikGateway";
import { hikValidBeginFromAccessStart } from "../lib/gateway/persons";
import { defaultRuleSchedule } from "../lib/hikSync";

/**
 * Failed sync ops için retry worker.
 *
 * Her 3 dakikada bir çalışır:
 * 1. status=failed olan ops'ları çek (attemptCount<5, deviceId online).
 * 2. Operation tipine göre uygun gateway helper'ını çağır.
 * 3. Başarı → status=done; başarısızlık → attemptCount++ + lastError güncelle,
 *    attemptCount>=5 ise terminal failed bırak.
 *
 * "Online" tanımı: device.hikLastSeenAt son 5 dakikada güncellenmiş.
 * Offline cihazlar sonraki retry penceresine ertelenir.
 *
 */

const HIK_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

type QueueResult = { retried: number; ok: number; failed: number };

export const processHikQueue = internalAction({
  args: {},
  handler: async (ctx): Promise<QueueResult> => processQueue(ctx),
});

/** Manual retries address one operation and never enter the general scan. */
export const processHikOperation = internalAction({
  args: { issueId: v.id("hikPendingOperations") },
  handler: async (ctx, args): Promise<QueueResult> => processQueue(ctx, args.issueId),
});

async function processQueue(ctx: ActionCtx, issueId?: Id<"hikPendingOperations">): Promise<QueueResult> {
    const candidates = await ctx.runMutation(
      internal.hikvisionSync.listRetryCandidates,
      { limit: issueId ? 1 : BATCH_SIZE, maxAttempts: MAX_ATTEMPTS, onlineWindowMs: HIK_ONLINE_WINDOW_MS, ...(issueId ? { issueId } : {}) },
    );

    if (candidates.length === 0) {
      return { retried: 0, ok: 0, failed: 0 };
    }

    const results = await Promise.all(
      candidates.map(async (c) => {
        try {
          const r = await executeOperation(ctx, c);
          return { id: c._id, ok: r.ok, error: r.error, superseded: r.superseded };
        } catch { return { id: c._id, ok: false, error: "Cihaz işlemi tamamlanamadı" }; }
      }),
    );

    let okCount = 0;
    let failedCount = 0;
    const writes: Promise<unknown>[] = [];
    for (const r of results) {
      if (r.ok) {
        okCount++;
        writes.push(r.superseded
          ? ctx.runMutation(internal.hikvisionSync.markOpSuperseded, { id: r.id, reason: SUPERSEDED_PERSON })
          : ctx.runMutation(internal.hikvisionSync.markOpDone, { id: r.id }));
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
}

type Candidate = FunctionReturnType<typeof internal.hikvisionSync.listRetryCandidates>[number];
type OpResult = { ok: boolean; error?: string; superseded?: boolean };

const SUPERSEDED_PERSON = "Kişinin bu cihaz için geçerli erişim kuralı kalmadı; işlem gereksiz";

/**
 * Hata kayıtları plan numarası taşımaz; kişi güncel kurallardan yeniden yazılır.
 * Kişi artık bu cihaza yetkili değilse kayıt amacını yitirmiştir (superseded).
 */
async function retryPersonFromRules(ctx: ActionCtx, c: Candidate, employeeId: unknown): Promise<OpResult> {
  if (typeof employeeId !== "string") return { ok: false, error: "Çalışan bilgisi eksik" };
  const id = employeeId as Id<"employees">;
  const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: id });
  const covered = data !== null && data.employee.isActive !== false && data.deviceRules.some(dr => dr.device._id === c.device._id);
  if (!covered) return { ok: true, superseded: true };
  const result = await ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
    employeeId: id, targetDeviceIds: [c.device._id], retrying: true,
  });
  if (result.failed > 0 || result.errors.length > 0 || result.synced === 0) return { ok: false, error: result.errors[0] ?? "Kişi cihaza yazılamadı" };
  return { ok: true };
}

/**
 * Tek bir kuyruk kaydını gerçekleştir — payload + operation tipine göre uygun helper.
 * Buraya yeni op tipi eklemek için: 1) schema enum, 2) hikvisionSync action,
 * 3) burada `case` ekle.
 */
async function executeOperation(
  ctx: ActionCtx,
  c: Candidate,
): Promise<OpResult> {
  if (["deletePerson", "deleteCard"].includes(c.operation) && await ctx.runMutation(internal.hikvisionSync.protectQueuedDeletion, { id: c._id })) return { ok: true };
  const devIndex = c.device.hikDevIndex;
  if (!devIndex) return { ok: false, error: "Cihaz gateway'e kayıtlı değil" };

  const payload = (c.payload ?? {}) as Record<string, unknown>;

  switch (c.operation) {
    case "addPerson":
    case "updatePerson": {
      const employee = c.employee;
      if (!employee?.cardNumber) return { ok: false, error: "Çalışan veya kart numarası yok" };
      const planTemplateNo = payload.planTemplateNo;
      if (typeof planTemplateNo !== "number") return await retryPersonFromRules(ctx, c, payload.employeeId);
      const result = await upsertPersonToDevice(devIndex, {
        employeeNo: employee.cardNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        planTemplateNo,
        doorCount: c.device.hikDoorCount,
        beginTime: hikValidBeginFromAccessStart(employee.accessStartsAt, Date.now()),
      });
      if (result.ok) {
        try {
          await ctx.runMutation(internal.hikvisionSync.supersedePersonDeletions, { deviceId: c.device._id, cardNumber: employee.cardNumber });
        } catch { /* Cleanup is optional; it must not block the queued card write. */ }
      }
      return result;
    }
    case "deletePerson": {
      const employeeNo = payload.employeeNo ?? payload.cardNumber;
      if (typeof employeeNo !== "string" || !employeeNo.trim()) return { ok: false, error: "Silme işi eski kart kimliğini içermiyor" };
      return await deletePersonFromDevice(devIndex, employeeNo);
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
      const identity = payload.employeeNo ?? payload.cardNumber;
      const cardNo = typeof identity === "string" ? identity : undefined;
      if (!cardNo) return { ok: false, error: "Kart numarası yok" };
      return await deleteCardFromDevice(devIndex, cardNo);
    }
    case "deleteFace": {
      const employeeNo = c.employee?.cardNumber;
      if (!employeeNo) return { ok: false, error: "Çalışan veya kart numarası yok" };
      return await deleteFaceFromDevice(devIndex, employeeNo);
    }
    case "addFingerprint": {
      const employeeId = payload.employeeId;
      const fingerNo = payload.fingerPrintID;
      if (typeof employeeId !== "string" || typeof fingerNo !== "number") return { ok: false, error: "Parmak izi bilgileri eksik" };
      try {
        await ctx.runQuery(internal.hikvisionSync.assertBiometricSyncAllowed, { employeeId: employeeId as Id<"employees">, deviceId: c.device._id });
      } catch { return { ok: false, error: "Biyometri izni doğrulanamadı; parmak izi gönderilmedi." }; }
      return await ctx.runAction(internal.actions.hikFingerprint.pushFingerprintToDevices, { employeeId: employeeId as Id<"employees">, fingerNo, deviceIds: [c.device._id], retrying: true });
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
      const schedule = defaultRuleSchedule(rule, rule.scheduleTemplate ?? null);
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
    case "rebootDevice": {
      return await rebootDeviceOnGateway(devIndex);
    }
    case "syncDoorStatusPlan":
    case "syncVerifyPlan": {
      const doorId = payload.doorId;
      if (typeof doorId !== "string") return { ok: false, error: "Plan payload.doorId eksik" };
      const door = await ctx.runQuery(internal.doors.getByIdInternal, { id: doorId as Id<"doors"> });
      if (!door) return { ok: false, error: "Kapı bulunamadı" };
      const device = await ctx.runQuery(internal.devices.getByIdInternal, { id: c.device._id });
      if (!device) return { ok: false, error: "Cihaz bulunamadı" };
      return c.operation === "syncDoorStatusPlan"
        ? sendStoredDoorStatusPlan(ctx, door, device)
        : sendStoredVerifyPlan(ctx, door, device);
    }

    default:
      return {
        ok: false,
        error: `Worker bu op tipini desteklemiyor: ${c.operation}`,
      };
  }
}


/** Continue the same bounded AcsEvent search without re-reading its first pages. */
export const continueHikBackfill = internalAction({
  args: {
    deviceId: v.id("devices"), devIndex: v.string(), searchID: v.string(),
    position: v.number(), startedAt: v.number(), maxPages: v.number(),
    startTime: v.optional(v.string()), lastEventAt: v.optional(v.number()),
    maxSerialNo: v.optional(v.number()), observedSerialNo: v.optional(v.number()),
    hop: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    await runBackfillContinuation(ctx, args);
  },
});
