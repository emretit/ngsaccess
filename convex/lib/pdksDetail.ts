/**
 * `cardReadings.getEmployeeAttendanceDetail`'in günlük hesap + özet çekirdeği. ctx YOK,
 * async YOK — tüm DB okuması ve shift çözümü çağıran handler'da kalır; bu modül yalnız
 * çözülmüş gün verisini işler. `pdksDetail.test.ts` golden testleriyle donduruldu.
 *
 * DİKKAT (R8): bu ekran mesaiyi **sabit 8 saatten** hesaplar
 * (`max(0, netMinutes − 8h)`) — tablo/bordro ekranlarının shift-duyarlı
 * `dailyOvertimeForShift`'inden BİLİNÇLİ farklıdır (ürün kararı bekliyor). Refactor bu
 * farkı KORUR; testler kazara değişmesin diye bunu da pinler.
 */
import type { Doc } from "../_generated/dataModel";
import {
  classifyDay,
  payrollCodeForDay,
  evaluateLateEarly,
  type EffectiveWorkSettings,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import {
  manualOverrideMinutes,
  minutesBetweenISO,
  resolveDayStatus,
  formatIstanbulTime,
  formatHoursLabel,
} from "./pdksCalc";
import { netWorkMinutes } from "./breakDeduction";

/**
 * Tek bir gün için devam detayını hesaplar. Manuel giriş/çıkış override'ı ham okumaların
 * önüne geçer; total → net (mola düşümü) → sabit-8h mesai. Statü/puantaj kodu/geç-erken
 * çıkış zaten test edilmiş lib primitiflerine delege edilir.
 */
export function computeAttendanceDetailDay(params: {
  date: string;
  dayReadings: Doc<"cardReadings">[];
  manualDay: Doc<"pdksRecords"> | undefined;
  leaves: Doc<"leaves">[];
  holiday: Doc<"holidays"> | null | undefined;
  dayShift: Doc<"shifts"> | null;
  workSettings: EffectiveWorkSettings;
  workingDays: string[];
}) {
  const {
    date: dk,
    dayReadings,
    manualDay,
    leaves,
    holiday,
    dayShift,
    workSettings,
    workingDays,
  } = params;

  const granted = dayReadings.filter((r) => r.accessStatus === "izin_verildi");
  const firstISO = manualDay?.entryTime
    ? `${dk}T${manualDay.entryTime}:00.000+03:00`
    : granted[0]?.accessTime ?? null;
  const lastISO = manualDay?.exitTime
    ? `${dk}T${manualDay.exitTime}:00.000+03:00`
    : granted.length > 1 ? granted[granted.length - 1].accessTime : null;

  let totalMinutes = 0;
  if (manualDay?.entryTime && manualDay?.exitTime) {
    totalMinutes = manualOverrideMinutes(
      manualDay.entryTime,
      manualDay.exitTime,
    );
  } else if (firstISO && lastISO) {
    totalMinutes = Math.max(0, minutesBetweenISO(firstISO, lastISO));
  }

  const cls = classifyDay(dk, workingDays, holiday);
  const hasLeave = leaves.some((l) => dk >= l.startDate && dk <= l.endDate);
  const leaveOnDay = leaves.find((l) => dk >= l.startDate && dk <= l.endDate);
  const code = payrollCodeForDay({
    classification: cls,
    hasLeave,
    hasAttendance: !!firstISO,
  });
  const daySettingsForLate = settingsForShift(dayShift, workSettings);
  const { isLate, isEarlyExit } = evaluateLateEarly(
    firstISO ?? undefined,
    lastISO ?? undefined,
    daySettingsForLate,
  );

  const status = resolveDayStatus({
    mode: "calendar",
    classification: cls,
    hasAttendance: !!firstISO,
    hasLeave,
    isLate,
  });

  const netMinutes = netWorkMinutes(totalMinutes, dayShift);
  const overtimeMinutes = Math.max(0, netMinutes - 8 * 60);
  totalMinutes = netMinutes;

  return {
    date: dk,
    firstEntry: firstISO ? formatIstanbulTime(firstISO) : null,
    lastExit: lastISO ? formatIstanbulTime(lastISO) : null,
    totalMinutes,
    totalHours: formatHoursLabel(totalMinutes),
    status,
    isLate,
    isEarlyExit,
    payrollCode: code,
    overtimeMinutes,
    isManual: !!manualDay,
    manualNote: manualDay?.manualNote ?? null,
    leaveType: leaveOnDay?.leaveType ?? null,
    rawReadings: dayReadings.map((r) => ({
      id: String(r._id),
      time: formatIstanbulTime(r.accessTime, true),
      accessStatus: r.accessStatus,
      direction: r.direction,
      deviceId: r.deviceId ? String(r.deviceId) : null,
    })),
  };
}

/** Gün listesinden özet sayaçları (çalışılan/geç/devamsız/izinli + toplam dakika/mesai). */
export function summarizeAttendanceDays(
  days: ReadonlyArray<{
    status: string;
    totalMinutes: number;
    overtimeMinutes: number;
  }>,
): {
  totalMinutes: number;
  workedDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeMinutes: number;
} {
  return days.reduce(
    (acc, d) => {
      acc.totalMinutes += d.totalMinutes;
      if (d.status === "present" || d.status === "late") acc.workedDays += 1;
      if (d.status === "late") acc.lateDays += 1;
      if (d.status === "absent") acc.absentDays += 1;
      if (d.status === "leave") acc.leaveDays += 1;
      acc.overtimeMinutes += d.overtimeMinutes;
      return acc;
    },
    {
      totalMinutes: 0,
      workedDays: 0,
      lateDays: 0,
      absentDays: 0,
      leaveDays: 0,
      overtimeMinutes: 0,
    },
  );
}
