/** Application limits, not a claim about a particular device firmware. */
export const CARD_NUMBER_MAX_LENGTH = 128;
export const NUMERIC_CARD_MAX_LENGTH = 20;

export function cardNumberError(
  value: string,
  options: { allowEmpty?: boolean; deviceBrand?: "hikvision" | "ide_smart" } = {},
): string | undefined {
  const card = value.trim();
  if (!card) return options.allowEmpty ? undefined : "Kart numarası zorunludur";
  if (card.length > CARD_NUMBER_MAX_LENGTH || !/^[A-Za-z0-9_-]+$/.test(card)) return "Kart numarası biçimi geçersiz";
  if (/^[0-9]+$/.test(card) && card.length > NUMERIC_CARD_MAX_LENGTH) return "Sayısal kart numarası en fazla 20 hane olabilir";
  if (options.deviceBrand === "ide_smart" && (!/^[0-9]+$/.test(card) || !Number.isSafeInteger(Number(card)) || Number(card) < 1)) {
    return "Kart numarası IDE için pozitif, güvenli bir tam sayı olmalı";
  }
  return undefined;
}
