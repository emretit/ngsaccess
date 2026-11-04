import {
  SGK_EKSIK_GUN_KODU,
  sgkCodeForAbsence,
  sgkCodeForLeaveType,
  type SgkEksikGunKodu,
} from "./sgkCodes";

export interface SgkApprovedLeave {
  startDate: string;
  endDate: string;
  leaveType: string;
}

export interface SgkEksikGunInput {
  /** Türkiye takviminde YYYY-MM-DD biçimindeki ay günleri. */
  monthDays: readonly string[];
  restDays: ReadonlySet<string>;
  holidayMap: ReadonlyMap<string, unknown>;
  workedDays: ReadonlySet<string>;
  approvedLeaves: readonly SgkApprovedLeave[];
}

export interface SgkEksikGunResult {
  eksikGunSayisi: number;
  eksikGunNedeni: SgkEksikGunKodu | null;
  primGunu: number;
}

/**
 * Tam ay, aylık ücretli çalışan hesabı. Hafta tatili ve UBGT eksik gün değildir.
 * Gün bazlı bu hesapta yarım günlük tatil de eksik gün oluşturmaz.
 * Kapsam dışı: md. 46 hafta tatili ücretine hak kazanma kuralı, ay ortası
 * işe giriş/çıkış (işe giriş tarihi alanı yok) ve kısmi süreli çalışanlar.
 */
export function calculateSgkEksikGun(input: SgkEksikGunInput): SgkEksikGunResult {
  const reasons = new Set<SgkEksikGunKodu>();
  let eksikGunSayisi = 0;

  for (const day of new Set(input.monthDays)) {
    if (input.restDays.has(day) || input.holidayMap.has(day) || input.workedDays.has(day)) {
      continue;
    }

    const leaves = input.approvedLeaves.filter(
      (leave) => leave.startDate <= day && leave.endDate >= day,
    );
    const codes = leaves.map((leave) => sgkCodeForLeaveType(leave.leaveType));
    // Çakışan izinler aynı günü çoğaltmaz; ücretli izin varsa gün primden düşülmez.
    if (codes.includes(null)) continue;

    eksikGunSayisi += 1;
    if (codes.length === 0) reasons.add(sgkCodeForAbsence());
    for (const code of codes) {
      if (code !== null) reasons.add(code);
    }
  }

  return {
    eksikGunSayisi,
    eksikGunNedeni: reasons.size > 1
      ? SGK_EKSIK_GUN_KODU.BIRDEN_FAZLA_NEDEN
      : reasons.values().next().value ?? null,
    primGunu: Math.max(0, 30 - eksikGunSayisi),
  };
}
