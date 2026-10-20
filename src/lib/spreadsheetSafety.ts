/**
 * CSV/Excel formül enjeksiyonu koruması: `= + - @` (baştaki boşluk dahil) ile başlayan metnin
 * başına `'` ekler; tablo programı hücreyi formül değil metin olarak açar.
 */
export function neutralizeSpreadsheetFormula(text: string): string {
  return /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
}
