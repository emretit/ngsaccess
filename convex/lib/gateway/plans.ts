"use node";

import { gatewayApiCallChecked, gatewayApiCall } from "./core";
import { findSupportFlag } from "./capabilities";
import { ALL_DAYS, MAX_SEGMENTS_PER_DAY, normalizeEndTime } from "./scheduling";
import type { Weekday } from "./scheduling";

// ============================================================================
// DOOR STATUS PLAN — mesai saatinde kapıyı otomatik açık/kapalı tutar.
// Üç adım zinciri: WeekPlan → PlanTemplate → Door'a link.
// ============================================================================

/** DoorStatus segment: her gün için bir zaman aralığı + kapı modu. */
export interface DoorStatusSegment {
  week: Weekday;
  id: number; // 1-indexed segment sırası (her gün max 8)
  enable: boolean;
  doorStatus: "remainOpen" | "remainClosed" | "normal";
  beginTime: string; // "HH:MM:SS"
  endTime: string; // "HH:MM:SS"
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
        templateName: `NGS ${templateNo}`,
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
        templateName: `NGS ${templateNo}`,
        weekPlanNo: opts.weekPlanNo,
        holidayGroupNo: opts.holidayGroupNo ? String(opts.holidayGroupNo) : "",
      },
    },
    devIndex,
  );
}

/** Official FingerPrint Terminals Pro Series, 7.4.2.1 / 10.3.6.1. */
export async function linkVerifyPlan(
  devIndex: string,
  readerNo: number,
  templateNo: number,
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/CardReaderPlan/${readerNo}`,
    "PUT",
    { CardReaderPlan: { templateNo } },
    devIndex,
  );
}

/** Manual 7.7.2.1 and 7.4.2.1–3: parent support implies child support; explicit false wins. */
export async function requirePlanCapabilities(
  devIndex: string,
  fields: string[],
): Promise<void> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/capabilities",
    "GET",
    null,
    devIndex,
  );
  if (result.status !== 200) throw new Error("Cihaz yeteneği okunamadı (cihaz çevrimdışı olabilir)");
  const flag = (field: string) => findSupportFlag(result.data, [field])?.value;
  const supported = (field: string): boolean => {
    const value = flag(field);
    if (value !== undefined) return value;
    // Preserve the pre-capability status path on older firmware omitting these flags.
    if (["isSupportDoorStatusPlan", "isSupportDoorStatusWeekPlanCfg", "isSupportDoorStatusPlanTemplate"].includes(field)) return true;
    if (field === "isSupportVerifyPlanTemplate") return flag("isSupportCardReaderPlan") === true;
    if (field === "isSupportVerifyWeekPlanCfg")
      return flag("isSupportCardRightWeekPlanCfg") === true || flag("isSupportVerifyPlanTemplate") === true || flag("isSupportCardReaderPlan") === true;
    return false;
  };
  if (fields.some(field => !supported(field)))
    throw new Error(fields.some(field => field.includes("Holiday") && !supported(field))
      ? "Bu cihaz tatil planını desteklemiyor"
      : "Bu cihaz istenen zaman planını desteklemiyor");
}
export async function getHolidayCapacity(
  devIndex: string,
  groupNo: number,
): Promise<number> {
  const readMax = (data: unknown, root: string, field: string): number => {
    if (!data || typeof data !== "object" || !(root in data)) return 0;
    const cfg: unknown = (data as Record<string, unknown>)[root];
    if (!cfg || typeof cfg !== "object") return 0;
    const range: unknown = (cfg as Record<string, unknown>)[field];
    if (
      !range ||
      typeof range !== "object" ||
      !("@max" in range) ||
      typeof range["@max"] !== "number"
    )
      return 0;
    return Number.isInteger(range["@max"]) ? range["@max"] : 0;
  };
  const plan = await gatewayApiCall(
    "/ISAPI/AccessControl/DoorStatusHolidayPlanCfg/capabilities",
    "GET",
    null,
    devIndex,
  );
  const group = await gatewayApiCall(
    "/ISAPI/AccessControl/DoorStatusHolidayGroupCfg/capabilities",
    "GET",
    null,
    devIndex,
  );
  const max = readMax(plan.data, "DoorStatusHolidayPlanCfg", "planNo");
  if (
    plan.status !== 200 ||
    group.status !== 200 ||
    !max ||
    groupNo > readMax(group.data, "DoorStatusHolidayGroupCfg", "groupNo")
  )
    throw new Error("Cihazın tatil planı kapasitesi doğrulanamadı");
  return max;
}
/** Official manual 10.3.2.7; one dated plan, all 8 slots to clear previous contents. */
export async function setDoorStatusHolidayPlan(
  devIndex: string,
  planNo: number,
  range: { beginDate: string; endDate: string },
  mode: DoorStatusSegment["doorStatus"],
) {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/DoorStatusHolidayPlanCfg/${planNo}`,
    "PUT",
    {
      DoorStatusHolidayPlanCfg: {
        enable: true,
        ...range,
        HolidayPlanCfg: Array.from({ length: 8 }, (_, index) => ({
          id: index + 1,
          enable: index === 0,
          doorStatus: mode,
          TimeSegment: {
            beginTime: "00:00:00",
            endTime: index === 0 ? normalizeEndTime("23:59:59") : "00:00:00",
          },
        })),
      },
    },
    devIndex,
  );
}
/** Official manual 10.3.2.3: CSV plan IDs, not embedded date objects. */
export async function setDoorStatusHolidayGroup(
  devIndex: string,
  groupNo: number,
  slots: number[],
) {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/DoorStatusHolidayGroupCfg/${groupNo}`,
    "PUT",
    {
      DoorStatusHolidayGroupCfg: {
        enable: true,
        groupName: `NGS ${groupNo}`,
        holidayPlanNo: slots.join(","),
      },
    },
    devIndex,
  );
}
