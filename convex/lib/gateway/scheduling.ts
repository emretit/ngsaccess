"use node";

import { gatewayApiCallChecked } from "./core";

// Access schedule (week plan passthrough)
export const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Weekday = (typeof ALL_DAYS)[number];

export interface WeekScheduleEntry {
  week: Weekday;
  beginTime: string; // "HH:MM:SS"
  endTime: string;
}

export const MAX_SEGMENTS_PER_DAY = 8;

/**
 * Haftalık plan — her gün için 8'e kadar zaman aralığı destekler.
 * `schedule` array'i aynı `week` değerine sahip birden fazla entry içerebilir
 * (örn. çift vardiya: 08:00-12:00 + 13:00-17:00).
 */
export async function setWeekPlanOnDevice(
  devIndex: string,
  weekPlanNo: number,
  schedule: WeekScheduleEntry[],
): Promise<{ ok: boolean; error?: string }> {
  const byDay = new Map<Weekday, WeekScheduleEntry[]>();
  for (const s of schedule) {
    const arr = byDay.get(s.week);
    if (arr) arr.push(s);
    else byDay.set(s.week, [s]);
  }

  // Cihazdan GET ile alınan gerçek format (DS-K1T8):
  //   - week: STRING ("Monday".."Sunday") — integer reddediliyor (badParameters).
  //   - Her gün için tam 8 segment gönderilmeli (boşlar enable:false, 00:00:00).
  //   - 24h erişim endTime "24:00:00" (23:59:59 reddediliyor).
  //   - Her segment authenticationTimesEnabled+authenticationTimes alanlarını da içerir.
  const EMPTY_SEGMENT = {
    beginTime: "00:00:00",
    endTime: "00:00:00",
  };
  const WeekPlanCfg: Array<{
    week: Weekday;
    id: number;
    enable: boolean;
    TimeSegment: { beginTime: string; endTime: string };
    authenticationTimesEnabled: boolean;
    authenticationTimes: number;
  }> = [];

  for (const day of ALL_DAYS) {
    const segments = byDay.get(day) ?? [];
    for (let idx = 0; idx < MAX_SEGMENTS_PER_DAY; idx++) {
      const s = segments[idx];
      WeekPlanCfg.push({
        week: day,
        id: idx + 1,
        enable: !!s,
        TimeSegment: s
          ? { beginTime: s.beginTime, endTime: normalizeEndTime(s.endTime) }
          : EMPTY_SEGMENT,
        authenticationTimesEnabled: false,
        authenticationTimes: 0,
      });
    }
  }

  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightWeekPlanCfg/${weekPlanNo}`,
    "PUT",
    { UserRightWeekPlanCfg: { enable: true, WeekPlanCfg } },
    devIndex,
  );
}

// DS-K1T8 24h erişimi `24:00:00` ile gösteriyor; `23:59:59` formatı reddediliyor.
export function normalizeEndTime(endTime: string): string {
  return endTime === "23:59:59" ? "24:00:00" : endTime;
}

/**
 * Plan template — kişiye atanan ünite. planTemplateNo person'un RightPlan'inde refere edilir.
 * Bir week plan + opsiyonel holiday group bağlar.
 */
export async function setPlanTemplate(
  devIndex: string,
  templateNo: number,
  opts: {
    templateName?: string;
    weekPlanNo: number;
    holidayGroupNo?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  // Cihazdan GET ile alınan format (DS-K1T8): holidayGroupNo CSV string ("" veya "1,2"),
  // array reddediliyor; `planTemplateID` field'ı yok (URL'den okunur); `enable` zorunlu.
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightPlanTemplate/${templateNo}`,
    "PUT",
    {
      UserRightPlanTemplate: {
        enable: true,
        templateName: opts.templateName ?? `Template ${templateNo}`,
        weekPlanNo: opts.weekPlanNo,
        holidayGroupNo: opts.holidayGroupNo ? String(opts.holidayGroupNo) : "",
      },
    },
    devIndex,
  );
}

/**
 * Holiday group — tatil tarih aralıkları kümesi. Group başına 16 holiday limiti var (cihaza göre).
 */
export interface HolidayEntry {
  beginDate: string; // "YYYY-MM-DD"
  endDate: string;
}

export async function setHolidayGroup(
  devIndex: string,
  groupNo: number,
  opts: { groupName?: string; holidays: HolidayEntry[] },
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightHolidayGroupCfg/${groupNo}`,
    "PUT",
    {
      UserRightHolidayGroup: {
        enable: true,
        groupName: opts.groupName ?? `Group ${groupNo}`,
        HolidayPlanCfg: opts.holidays.map((h, idx) => ({
          id: idx + 1,
          beginDate: h.beginDate,
          endDate: h.endDate,
        })),
      },
    },
    devIndex,
  );
}

/**
 * Holiday plan — tatil günlerinde geçerli olacak zaman aralıkları.
 * WeekPlan ile aynı `TimeSegment` nested shape — flat field firmware'da reddedilir.
 */
export async function setHolidayPlan(
  devIndex: string,
  planNo: number,
  segments: { beginTime: string; endTime: string }[],
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightHolidayPlanCfg/${planNo}`,
    "PUT",
    {
      UserRightHolidayPlanCfg: {
        enable: true,
        HolidayPlanCfg: segments.slice(0, 8).map((s, idx) => ({
          id: idx + 1,
          enable: true,
          TimeSegment: { beginTime: s.beginTime, endTime: s.endTime },
        })),
      },
    },
    devIndex,
  );
}

