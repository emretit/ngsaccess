export function isPdksBudgetError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("data" in error)) return false;
  const data: unknown = error.data;
  return !!data && typeof data === "object" && "code" in data && data.code === "PDKS_READ_BUDGET";
}
export function pdksErrorMessage(error: unknown): string {
  return isPdksBudgetError(error) ? "Okuma sınırı aşıldı. Daha dar bir tarih aralığı seçin." : "Hesaplama tamamlanamadı. Lütfen yeniden deneyin.";
}
