/** Hik fingerPrintID 1-10 → parmak adı (kayıt diyaloğu ve tablo aynı sırayı kullanır). */
export const fingerNames = ["Sağ başparmak", "Sağ işaret", "Sağ orta", "Sağ yüzük", "Sağ serçe", "Sol başparmak", "Sol işaret", "Sol orta", "Sol yüzük", "Sol serçe"];

export function fingerName(fingerNo: number): string {
  return fingerNames[fingerNo - 1] ?? `Parmak ${fingerNo}`;
}
