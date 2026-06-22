import type { Doc, Id } from "../_generated/dataModel";
import {
  isoTimeToTRMinutes,
  parseHHMM,
  type EffectiveWorkSettings,
} from "./pdksHelpers";
import { thresholdsForShift } from "./shiftResolver";

export type PdksChartData = {
  dailyAttendance: Array<{
    name: string;
    date: string;
    present: number;
    late: number;
    absent: number;
    rate: number;
  }>;
  departmentAbsence: Array<{
    name: string;
    absences: number;
  }>;
  lateDistribution: Array<{
    hour: string;
    count: number;
  }>;
  hourlyTrend: Array<{
    hour: string;
    checkins: number;
  }>;
  lateMinutesSamples: number[];
};

type EmployeeDayRecord = {
  firstEntry?: string;
  hasLate: boolean;
  lateMinutes: number;
};

const DAY_NAMES = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

export function emptyPdksChartData(): PdksChartData {
  return {
    dailyAttendance: [],
    departmentAbsence: [],
    lateDistribution: [],
    hourlyTrend: [],
    lateMinutesSamples: [],
  };
}

function readingEmployeeKey(reading: Doc<"cardReadings">): string {
  return String(reading.employeeId ?? reading.cardNo);
}

export function computePdksChartData(params: {
  readings: Doc<"cardReadings">[];
  startDate: string;
  endDate: string;
  chartSettings: EffectiveWorkSettings;
  employeeDepartmentByKey: ReadonlyMap<string, string>;
  resolveShift: (
    employeeId: Id<"employees">,
    dateISO: string,
  ) => Doc<"shifts"> | null;
}): PdksChartData {
  const {
    readings,
    startDate,
    endDate,
    chartSettings,
    employeeDepartmentByKey,
    resolveShift,
  } = params;
  const fallbackLateThresholdMin =
    parseHHMM(chartSettings.workStartTime) + chartSettings.maxLateMinutes;

  const dailyMap = new Map<
    string,
    {
      present: Set<string>;
      late: Set<string>;
      absent: Set<string>;
      total: Set<string>;
    }
  >();
  const departmentAbsenceMap = new Map<string, number>();
  const lateByHourMap = new Map<number, number>();
  const hourlyCheckinMap = new Map<string, number>();

  const allEmployeeIds = new Set<string>();
  for (const r of readings) {
    allEmployeeIds.add(readingEmployeeKey(r));
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split("T")[0];
    dailyMap.set(dateKey, {
      present: new Set(),
      late: new Set(),
      absent: new Set(),
      total: new Set(allEmployeeIds),
    });
  }

  const employeeDayMap = new Map<string, Map<string, EmployeeDayRecord>>();
  const lateMinutesSamples: number[] = [];

  for (const r of readings) {
    const empKey = readingEmployeeKey(r);
    const dateKey = r.accessTime.split("T")[0];
    const dayData = dailyMap.get(dateKey);
    if (!dayData) continue;

    if (r.accessStatus === "izin_verildi") {
      let empDay = employeeDayMap.get(empKey);
      if (!empDay) {
        empDay = new Map();
        employeeDayMap.set(empKey, empDay);
      }
      let rec = empDay.get(dateKey);
      if (!rec) {
        rec = { hasLate: false, lateMinutes: 0 };
        empDay.set(dateKey, rec);
      }
      if (!rec.firstEntry) {
        rec.firstEntry = r.accessTime;
        const arrivalMin = isoTimeToTRMinutes(r.accessTime);
        const shift = r.employeeId ? resolveShift(r.employeeId, dateKey) : null;
        const lateThresholdMin = shift
          ? thresholdsForShift(shift, chartSettings).lateThresholdMin
          : fallbackLateThresholdMin;
        rec.hasLate = arrivalMin > lateThresholdMin;
        rec.lateMinutes = Math.max(0, arrivalMin - lateThresholdMin);
      }
    }
  }

  for (const [empKey, days] of employeeDayMap) {
    for (const [dateKey, rec] of days) {
      const dayData = dailyMap.get(dateKey);
      if (!dayData) continue;
      dayData.present.add(empKey);
      if (rec.hasLate) {
        dayData.late.add(empKey);
        if (rec.lateMinutes > 0) lateMinutesSamples.push(rec.lateMinutes);
        const firstReading = readings.find(
          (r) => readingEmployeeKey(r) === empKey,
        );
        if (firstReading?.employeeId && rec.firstEntry) {
          const h = new Date(rec.firstEntry).getHours();
          lateByHourMap.set(h, (lateByHourMap.get(h) ?? 0) + 1);
        }
      }
    }
  }

  for (const dayData of dailyMap.values()) {
    for (const empKey of allEmployeeIds) {
      if (!dayData.present.has(empKey)) {
        dayData.absent.add(empKey);
      }
    }
  }

  for (const [, dayData] of dailyMap) {
    for (const empKey of dayData.absent) {
      const deptName = employeeDepartmentByKey.get(empKey) ?? "Bilinmiyor";
      departmentAbsenceMap.set(
        deptName,
        (departmentAbsenceMap.get(deptName) ?? 0) + 1,
      );
    }
  }

  const dailyAttendance = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, data]) => {
      const d = new Date(dateKey);
      return {
        name: DAY_NAMES[d.getDay()],
        date: dateKey,
        present: data.present.size,
        late: data.late.size,
        absent: data.absent.size,
        rate:
          data.total.size > 0
            ? Math.round((data.present.size / data.total.size) * 100)
            : 0,
      };
    });

  const departmentAbsence = Array.from(departmentAbsenceMap.entries()).map(
    ([name, value]) => ({
      name,
      absences: value,
    }),
  );

  const lateDistribution = Array.from(lateByHourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({
      hour: `${hour}:00`,
      count,
    }));

  for (const r of readings) {
    if (r.accessStatus !== "izin_verildi") continue;
    const hourKey = r.accessTime.slice(11, 13);
    hourlyCheckinMap.set(hourKey, (hourlyCheckinMap.get(hourKey) ?? 0) + 1);
  }

  const hourlyTrend = Array.from(hourlyCheckinMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, checkins]) => ({
      hour: `${hour}:00`,
      checkins,
    }));

  return {
    dailyAttendance,
    departmentAbsence,
    lateDistribution,
    hourlyTrend,
    lateMinutesSamples,
  };
}
