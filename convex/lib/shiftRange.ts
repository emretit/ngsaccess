/** Üst tarih, bitişi olmayan serileri mevcut tarih indekslerinde sıralanabilir tutar. */
export const OPEN_SHIFT_END = "9999-12-31";
export function shiftEndLabel(date: string) {
  return date === OPEN_SHIFT_END ? "Süresiz" : date;
}
