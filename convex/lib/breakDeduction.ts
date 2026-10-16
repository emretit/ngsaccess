import { parseHHMM } from "./pdksHelpers";

/**
 * 4857 sayılı İş Kanunu madde 68:
 * - 4 saat veya daha kısa (1-240dk): en az 15 dk mola
 * - 4 saatten fazla, 7.5 saate kadar dahil (241-450dk): en az 30 dk mola
 * - 7.5 saatten fazla (>450dk): en az 60 dk mola
 * - Çalışma yoksa (≤0dk): mola yok
 *
 * Mola süresi çalışma süresinden sayılmaz; dolayısıyla bordro/FM hesabında düşülür.
 */
export function legalBreakMinutes(totalRawMinutes: number): number {
  if (totalRawMinutes <= 0) return 0;
  if (totalRawMinutes <= 240) return 15;
  if (totalRawMinutes <= 450) return 30;
  return 60;
}

interface ShiftBreakWindow {
  breakStart?: string;
  breakEnd?: string;
}

/**
 * Verilen vardiya mola penceresi entry-exit aralığına tam düşüyorsa fiili mola süresi;
 * yoksa kanuni kademe uygulanır. Sonuç dakika cinsindendir.
 */
export function computeBreakDeduction(
  totalRawMinutes: number,
  shift?: ShiftBreakWindow | null,
  options?: { entryMinutes?: number; exitMinutes?: number },
): number {
  if (totalRawMinutes <= 0) return 0;

  if (shift?.breakStart && shift?.breakEnd) {
    const bs = parseHHMM(shift.breakStart);
    const be = parseHHMM(shift.breakEnd);
    const shiftBreak = Math.max(0, be - bs);
    if (
      options?.entryMinutes !== undefined &&
      options?.exitMinutes !== undefined
    ) {
      const overlap =
        Math.min(options.exitMinutes, be) -
        Math.max(options.entryMinutes, bs);
      if (overlap > 0) return overlap;
    } else if (shiftBreak > 0) {
      return shiftBreak;
    }
  }
  return legalBreakMinutes(totalRawMinutes);
}

/**
 * `totalRawMinutes - computeBreakDeduction(...)` shortcut.
 */
export function netWorkMinutes(
  totalRawMinutes: number,
  shift?: ShiftBreakWindow | null,
  options?: { entryMinutes?: number; exitMinutes?: number },
): number {
  return Math.max(
    0,
    totalRawMinutes - computeBreakDeduction(totalRawMinutes, shift, options),
  );
}
