/**
 * `cardReadings.getMonthlyPayrollSheet`'in per-gün bordro hücresi çekirdeği. ctx YOK,
 * async YOK — DB okuması + shift çözümü + haftalık mesai toplama (bucketWeeklyOvertime)
 * çağıran handler'da kalır; bu modül tek günün hücresini hesaplar.
 * `pdksPayroll.test.ts` golden testleriyle donduruldu.
 *
 * DİKKAT (R8): bordro mesaiyi **shift-duyarlı** `dailyOvertimeForShift` + haftalık
 * bucketleme ile hesaplar — detay ekranının sabit-8h kuralından BİLİNÇLİ farklıdır
 * (ürün kararı bekliyor). Refactor bu farkı KORUR.
 */
import type { Doc } from "../_generated/dataModel";
import {
  parseHHMM,
  classifyDay,
  multiplierForClassification,
  payrollCodeForDay,
  evaluateLateEarly,
  dailyOvertimeForShift,
  isoTimeToTRMinutes,
  overtimePayTRY,
  type EffectiveWorkSettings,
  type EffectiveOvertimeRates,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import { minutesBetweenISO } from "./pdksCalc";
import { netWorkMinutes } from "./breakDeduction";

/**
 * Bir çalışanın tek günü için bordro hücresi. Manuel giriş/çıkış override'ı ham okumaların
 * önüne geçer; ham → net (mola) → shift-duyarlı günlük mesai → çarpan → TL ücret. `dayReadings`
 * ham gelir (fn izin_verildi filtreler + zamana göre sıralar). `hasLeave` çağıranca hesaplanır.
 */
export function computePayrollCell(params: {
  date: string;
  manual: Doc<"pdksRecords"> | undefined;
  dayReadings: Doc<"cardReadings">[];
  hasLeave: boolean;
  holiday: Doc<"holidays"> | null | undefined;
  workingDays: string[];
  dayShift: Doc<"shifts"> | null;
  workSettings: EffectiveWorkSettings;
  overtimeRates: EffectiveOvertimeRates;
  empHourlyRate: number | null;
}) {
  const {
    date: d,
    manual,
    hasLeave,
    holiday,
    workingDays,
    dayShift,
    workSettings,
    overtimeRates,
    empHourlyRate,
  } = params;

  const dayReadings = params.dayReadings
    .filter((r) => r.accessStatus === "izin_verildi")
    .sort(
      (a, b) =>
        new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime(),
    );

  const cls = classifyDay(d, workingDays, holiday);
  const hasAttendance =
    (manual?.entryTime != null && manual?.exitTime != null) ||
    dayReadings.length >= 2;
  const code = payrollCodeForDay({
    classification: cls,
    hasLeave,
    hasAttendance,
  });

  let rawTotalMin = 0;
  let entryMin: number | undefined;
  let exitMin: number | undefined;
  if (manual?.entryTime && manual?.exitTime) {
    entryMin = parseHHMM(manual.entryTime);
    exitMin = parseHHMM(manual.exitTime);
    rawTotalMin = Math.max(0, exitMin - entryMin);
  } else if (dayReadings.length >= 2) {
    const first = dayReadings[0];
    const last = dayReadings[dayReadings.length - 1];
    rawTotalMin = minutesBetweenISO(first.accessTime, last.accessTime);
    entryMin = isoTimeToTRMinutes(first.accessTime);
    exitMin = isoTimeToTRMinutes(last.accessTime);
  }

  const entryISO = manual?.entryTime
    ? `${d}T${manual.entryTime}:00.000`
    : dayReadings[0]?.accessTime;
  const exitISO = manual?.exitTime
    ? `${d}T${manual.exitTime}:00.000`
    : dayReadings[dayReadings.length - 1]?.accessTime;
  const daySettings = settingsForShift(dayShift, workSettings);
  const { isLate, isEarlyExit } = evaluateLateEarly(
    entryISO,
    exitISO !== entryISO ? exitISO : undefined,
    daySettings,
  );

  const totalMin = netWorkMinutes(rawTotalMin, dayShift, {
    entryMinutes: entryMin,
    exitMinutes: exitMin,
  });

  const overtimeMin = dailyOvertimeForShift({
    classification: cls,
    netMinutes: totalMin,
    lastExitMinutes: exitMin,
    shift: dayShift,
    workSettings,
  });
  const multiplier =
    overtimeMin > 0 ? multiplierForClassification(cls, overtimeRates) : 0;
  const overtimePayAmount = overtimePayTRY({
    overtimeMinutes: overtimeMin,
    multiplier,
    hourlyRate: empHourlyRate,
  });

  return {
    date: d,
    payrollCode: code,
    totalMinutes: totalMin,
    overtimeMinutes: overtimeMin,
    multiplier,
    overtimePayTRY: overtimePayAmount,
    isLate,
    isEarlyExit,
    isManual: !!manual,
    classification: cls,
  };
}
