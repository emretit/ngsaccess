"use node";

import { gatewayApiCallChecked } from "./core";
import { ALL_DAYS, MAX_SEGMENTS_PER_DAY, normalizeEndTime } from "./scheduling";
import type { Weekday } from "./scheduling";

// ============================================================================
// DOOR STATUS PLAN — mesai saatinde kapıyı otomatik açık/kapalı tutar.
// Üç adım zinciri: WeekPlan → PlanTemplate → Door'a link.
// ============================================================================

/** DoorStatus segment: her gün için bir zaman aralığı + kapı modu. */
export interface DoorStatusSegment {
  week: Weekday;
  id: number;        // 1-indexed segment sırası (her gün max 8)
  enable: boolean;
  doorStatus: "remainOpen" | "remainClosed" | "normal";
  beginTime: string; // "HH:MM:SS"
  endTime: string;   // "HH:MM:SS"
}

/**
 * Cihaza DoorStatus haftalık planı yazar.
 * setWeekPlanOnDevice deseni izlenerek her gün için 8 segment (boşlar disable) gönderilir.
 * planNo: cihaz-tarafı plan slotu (1-based). Kapı başına ayrı planNo önerilir.
 */
export async function setDoorStatusWeekPlan(
  devIndex: string,
  planNo: number,
  segments: DoorStatusSegment[],
): Promise<{ ok: boolean; error?: string }> {
  // Gün bazında groupby
  const byDay = new Map<Weekday, DoorStatusSegment[]>();
  for (const s of segments) {
    const arr = byDay.get(s.week);
    if (arr) arr.push(s);
    else byDay.set(s.week, [s]);
  }

  const EMPTY_SEGMENT: DoorStatusSegment = {
    week: "Monday",
    id: 1,
    enable: false,
    doorStatus: "normal",
    beginTime: "00:00:00",
    endTime: "00:00:00",
  };

  const WeekPlanCfg: Array<{
    week: Weekday;
    id: number;
    enable: boolean;
    doorStatus: "remainOpen" | "remainClosed" | "normal";
    TimeSegment: { beginTime: string; endTime: string };
  }> = [];

  for (const day of ALL_DAYS) {
    const daySegs = byDay.get(day) ?? [];
    for (let idx = 0; idx < MAX_SEGMENTS_PER_DAY; idx++) {
      const s = daySegs[idx] ?? { ...EMPTY_SEGMENT, week: day, id: idx + 1 };
      WeekPlanCfg.push({
        week: day,
        id: idx + 1,
        enable: s.enable,
        doorStatus: s.doorStatus,
        TimeSegment: {
          beginTime: s.beginTime,
          endTime: s.enable ? normalizeEndTime(s.endTime) : "00:00:00",
        },
      });
    }
  }

  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/DoorStatusWeekPlanCfg/${planNo}`,
    "PUT",
    { DoorStatusWeekPlanCfg: { enable: true, WeekPlanCfg } },
    devIndex,
  );
}

/**
 * DoorStatus plan template'i yazar (week plan + opsiyonel holiday group bağlar).
 * setPlanTemplate deseni izlendi.
 */
export async function setDoorStatusPlanTemplate(
  devIndex: string,
  templateNo: number,
  opts: { weekPlanNo: number; holidayGroupNo?: number },
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/DoorStatusPlanTemplate/${templateNo}`,
    "PUT",
    {
      DoorStatusPlanTemplate: {
        enable: true,
        templateNo,
        weekPlanNo: opts.weekPlanNo,
        holidayGroupNo: opts.holidayGroupNo ? String(opts.holidayGroupNo) : "",
      },
    },
    devIndex,
  );
}

/**
 * Kapıya DoorStatus plan template'ini bağlar (veya templateNo=0 ile iptal eder).
 * doorNo: cihaz fiziksel kapı numarası (1-based; doors.hikDoorNo ?? 1).
 */
export async function linkDoorStatusPlan(
  devIndex: string,
  doorNo: number,
  templateNo: number,
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/DoorStatusPlan/${doorNo}`,
    "PUT",
    { DoorStatusPlan: { templateNo } },
    devIndex,
  );
}

// ============================================================================
// VERIFY WEEK PLAN — saate göre doğrulama modunu değiştirir.
// ============================================================================

/** Verify segment: her gün için bir zaman aralığı + doğrulama modu. */
export interface VerifySegment {
  week: Weekday;
  id: number;
  enable: boolean;
  verifyMode: string; // "cardOrFace", "card", "faceOrFingerprintOrCard" vb.
  beginTime: string;
  endTime: string;
}

/**
 * Cihaza Verify haftalık planı yazar.
 * setWeekPlanOnDevice ve setDoorStatusWeekPlan deseni izlendi.
 */
export async function setVerifyWeekPlan(
  devIndex: string,
  planNo: number,
  segments: VerifySegment[],
): Promise<{ ok: boolean; error?: string }> {
  const byDay = new Map<Weekday, VerifySegment[]>();
  for (const s of segments) {
    const arr = byDay.get(s.week);
    if (arr) arr.push(s);
    else byDay.set(s.week, [s]);
  }

  const WeekPlanCfg: Array<{
    week: Weekday;
    id: number;
    enable: boolean;
    verifyMode: string;
    TimeSegment: { beginTime: string; endTime: string };
  }> = [];

  for (const day of ALL_DAYS) {
    const daySegs = byDay.get(day) ?? [];
    for (let idx = 0; idx < MAX_SEGMENTS_PER_DAY; idx++) {
      const s = daySegs[idx];
      WeekPlanCfg.push({
        week: day,
        id: idx + 1,
        enable: !!s,
        verifyMode: s?.verifyMode ?? "card",
        TimeSegment: {
          beginTime: s?.beginTime ?? "00:00:00",
          endTime: s?.enable ? normalizeEndTime(s.endTime) : "00:00:00",
        },
      });
    }
  }

  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/VerifyWeekPlanCfg/${planNo}`,
    "PUT",
    { VerifyWeekPlanCfg: { enable: true, WeekPlanCfg } },
    devIndex,
  );
}

/**
 * Verify plan template yazar.
 */
export async function setVerifyPlanTemplate(
  devIndex: string,
  templateNo: number,
  opts: { weekPlanNo: number; holidayGroupNo?: number },
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/VerifyPlanTemplate/${templateNo}`,
    "PUT",
    {
      VerifyPlanTemplate: {
        enable: true,
        templateNo,
        weekPlanNo: opts.weekPlanNo,
        holidayGroupNo: opts.holidayGroupNo ? String(opts.holidayGroupNo) : "",
      },
    },
    devIndex,
  );
}

/**
 * Kapıya Verify plan template'ini bağlar (templateNo=0 ile iptal).
 *
 * // VERIFY: Hik ISAPI dokümantasyonunda VerifyPlan'ın kapıya bağlanma path'i
 * // netleştirilmedi. En makul alternatifler:
 * //   A) /ISAPI/AccessControl/VerifyPlan/<doorNo>  (DoorStatusPlan ile simetrik)
 * //   B) /ISAPI/AccessControl/VerifyWeekPlanCfg/template/<doorNo>
 * //   C) Okuyucu bazlı: /ISAPI/AccessControl/CardReader/VerifyPlan/<readerNo>
 * // Mevcut implementasyon (A) seçeneğini kullanıyor; canlı cihaz testiyle doğrulanmalı.
 */
export async function linkVerifyPlan(
  devIndex: string,
  doorNo: number,
  templateNo: number,
): Promise<{ ok: boolean; error?: string }> {
  // VERIFY: path cihaz firmware'ına göre farklılık gösterebilir (bkz. yukarıdaki yorum).
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/VerifyPlan/${doorNo}`,
    "PUT",
    { VerifyPlan: { templateNo } },
    devIndex,
  );
}
