/**
 * CSV/Excel formül enjeksiyonu koruması: `= + - @` (baştaki boşluk dahil) ya da TAB/CR ile başlayan
 * metnin başına `'` ekler; tablo programı hücreyi formül değil metin olarak açar. Tek başına `-`
 * (boş değer yer tutucusu) formül olamaz, olduğu gibi kalır.
 */
export function neutralizeSpreadsheetFormula(text: string): string {
  if (text === '-') return text;
  return /^[\t\r]|^\s*[=+@-]/.test(text) ? `'${text}` : text;
}
