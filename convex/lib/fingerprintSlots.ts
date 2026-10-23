/**
 * Kişi başına parmak izi slotları. Hik fingerPrintID 1-10'u destekler; biz 5 ile sınırlıyoruz
 * (talep gelirse artırılır). Hangi parmağın okutulduğu önemsiz (Hik-Connect gibi): slot yalnız numaradır.
 */
export const MAX_FINGERPRINTS_PER_EMPLOYEE = 5;
export const FINGERPRINT_LIMIT_MESSAGE = `Kişi başına en fazla ${MAX_FINGERPRINTS_PER_EMPLOYEE} parmak izi kaydedilebilir; yenisi için birini silin.`;

/** Yeni kayıt için ilk boş slot; sınır doluysa null. Eski 6-10 slotları da sınıra sayılır. */
export function nextFreeFingerNo(usedFingerNos: readonly number[]): number | null {
  const used = new Set(usedFingerNos);
  if (used.size >= MAX_FINGERPRINTS_PER_EMPLOYEE) return null;
  for (let fingerNo = 1; fingerNo <= MAX_FINGERPRINTS_PER_EMPLOYEE; fingerNo++) if (!used.has(fingerNo)) return fingerNo;
  return null;
}

export function fingerprintLabel(fingerNo: number): string {
  return `Parmak izi ${fingerNo}`;
}
