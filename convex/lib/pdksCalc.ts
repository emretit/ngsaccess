/**
 * PDKS gün-hesabı için SAF yapı taşları.
 *
 * Bu modül `ctx`/DB/async İÇERMEZ — yalnız plain-type girdi alıp değer döner,
 * böylece `accessDecision.ts` / `reconcileMath.ts` gibi birim-test edilebilir.
 * Tablo, bordro ve kişi detayının toplam/net/fazla mesai hesabı pdksDay.ts'te
 * birleşir; bu modül biçimleme, dönem ve durum gibi küçük saf yapı taşlarını içerir.
 */
import {
  parseHHMM,
  isoTimeToTRMinutes,
  type EffectiveWorkSettings,
} from "./pdksHelpers";

export type DayStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "weekend"
  | "holiday";

/**
 * `startDate`..`endDate` (dahil) arası YYYY-MM-DD anahtarları, UTC gün döngüsüyle.
 * getPdksTableData (442-449) ve getEmployeeAttendanceDetail (2184-2191) ile birebir.
 */
export function buildPeriodDateKeys(
  startDate: string,
  endDate: string,
): string[] {
  const keys: string[] = [];
  for (
    let d = new Date(`${startDate}T00:00:00.000Z`);
    d <= new Date(`${endDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    keys.push(d.toISOString().split("T")[0]);
  }
  return keys;
}

/**
 * Manuel giriş/çıkış (HH:MM) arasındaki dakika; negatifler 0'a kırpılır.
 * 3 query'de tekrarlayan `Math.max(0, parseHHMM(exit) - parseHHMM(entry))`.
 */
export function manualOverrideMinutes(
  entryTime: string,
  exitTime: string,
): number {
  return Math.max(0, parseHHMM(exitTime) - parseHHMM(entryTime));
}

/**
 * İki ISO zaman damgası arası tam dakika (floor). Kırpma YAPMAZ — çağıran
 * gerektiğinde `Math.max(0, …)` uygular (table single-day kırpmaz, detail kırpar).
 */
export function minutesBetweenISO(fromISO: string, toISO: string): number {
  return Math.floor(
    (new Date(toISO).getTime() - new Date(fromISO).getTime()) / 60000,
  );
}

/**
 * Geç kalınan dakika. getPdksTableData matrix bloğunun (699-710) saf hâli:
 * ISO'yu UTC+3'e çevir, gün-içi dakikadan vardiya başlangıcı + toleransı çıkar.
 * `isLate` false ya da giriş yoksa 0.
 */
export function computeLateMinutes(
  firstISO: string | null | undefined,
  isLate: boolean,
  settings: EffectiveWorkSettings,
): number {
  if (!isLate || !firstISO) return 0;
  const istanbulMins = isoTimeToTRMinutes(firstISO);
  const startMins = parseHHMM(settings.workStartTime);
  const tolerance = settings.maxLateMinutes;
  return Math.max(0, istanbulMins - startMins - tolerance);
}

/**
 * Tolerans sonrası erken çıkış dakikası: vardiya bitişi - tolerans - çıkış saati.
 * `isEarlyExit` false ya da çıkış yoksa 0.
 */
export function computeEarlyExitMinutes(
  lastISO: string | null | undefined,
  isEarlyExit: boolean,
  settings: EffectiveWorkSettings,
): number {
  if (!isEarlyExit || !lastISO) return 0;
  const threshold = parseHHMM(settings.workEndTime) - settings.earlyExitToleranceMinutes;
  return Math.max(0, threshold - isoTimeToTRMinutes(lastISO));
}

/** Dashboard mola kuralı; gece yarısını aşan mola pencereleri desteklenmez. */
export function computeBreakViolation(params: {
  punchTimes: readonly string[];
  breakStart?: string | null;
  breakEnd?: string | null;
}): boolean {
  const { punchTimes, breakStart, breakEnd } = params;
  if (punchTimes.length < 2 || !breakStart || !breakEnd) return false;
  const start = parseHHMM(breakStart);
  const end = parseHHMM(breakEnd);
  if (start > end) return false;
  const timestamps = punchTimes.map((time) => new Date(time).getTime());
  const first = Math.min(...timestamps);
  const last = Math.max(...timestamps);
  if (Math.floor((last - first) / 60000) < 450) return false;
  return !punchTimes.some((time) => {
    const minute = isoTimeToTRMinutes(time);
    return minute >= start && minute <= end;
  });
}

/** summary modu yalnız bu 4 değeri üretir (hafta sonu/tatil yok). */
export type SummaryDayStatus = "present" | "late" | "absent" | "leave";

interface DayStatusInput {
  classification: "workday" | "weekend" | "holiday" | "halfDayHoliday";
  hasAttendance: boolean;
  hasLeave: boolean;
  isLate: boolean;
}

/**
 * Bir günün durumu.
 *
 * - `mode: "summary"` → getPdksTableData tek-gün mantığı (506-513): hafta sonu/
 *   tatil ayrımı YOK; izin yalnız devamsızken geçerli. Dönüş dar `SummaryDayStatus`
 *   — frontend `EmployeeRecord.status` (4'lü union) ile birebir.
 * - `mode: "calendar"` → matrix (712-719) + detail (2249-2253) mantığı: tatil/
 *   hafta sonu sınıfı taban; devam → present/late, devam yoksa izin → leave
 *   (öncelik: devam > izin > hafta sonu/tatil > devamsız).
 */
export function resolveDayStatus(
  opts: { mode: "summary" } & DayStatusInput,
): SummaryDayStatus;
export function resolveDayStatus(
  opts: { mode: "calendar" } & DayStatusInput,
): DayStatus;
export function resolveDayStatus(
  opts: { mode: "summary" | "calendar" } & DayStatusInput,
): DayStatus {
  const { mode, classification, hasAttendance, hasLeave, isLate } = opts;

  if (mode === "summary") {
    if (hasLeave && !hasAttendance) return "leave";
    if (hasAttendance) return isLate ? "late" : "present";
    return "absent";
  }

  // calendar
  let status: DayStatus = "absent";
  if (classification === "holiday") status = "holiday";
  else if (classification === "weekend") status = "weekend";
  if (hasAttendance) status = isLate ? "late" : "present";
  else if (hasLeave) status = "leave";
  return status;
}

/**
 * Bir kart okumasını çalışana eşler: önce employeeId (geçerli kümede mi),
 * yoksa cardNo → çalışan haritası. Eşleşmezse null.
 * getPdksTableData (370-379) ve getMonthlyPayrollSheet (1174-1187) ortak mantığı.
 */
export function matchEmployeeKey(
  reading: { employeeId?: string | null; cardNo?: string | null },
  validEmployeeIds: ReadonlySet<string>,
  empIdByCard: ReadonlyMap<string, string>,
): string | null {
  if (reading.employeeId && validEmployeeIds.has(String(reading.employeeId))) {
    return String(reading.employeeId);
  }
  if (reading.cardNo && empIdByCard.has(reading.cardNo)) {
    return empIdByCard.get(reading.cardNo) ?? null;
  }
  return null;
}

/**
 * ISO zaman damgasını İstanbul saatiyle "HH:MM" (ya da `withSeconds` ile
 * "HH:MM:SS") biçimler. Tüm PDKS query'lerindeki toLocaleTimeString tekrarı.
 */
export function formatIstanbulTime(
  iso: string,
  withSeconds = false,
): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    timeZone: "Europe/Istanbul",
  });
}

/** Dakikayı "Xh Ym" etiketine çevirir (totalHours alanları). */
export function formatHoursLabel(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
