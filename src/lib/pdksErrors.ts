export function pdksErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return undefined;
  const data: unknown = error.data;
  return data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : undefined;
}
export const isPdksBudgetError = (error: unknown) => pdksErrorCode(error) === "PDKS_READ_BUDGET";
export function pdksErrorMessage(error: unknown): string {
  if (pdksErrorCode(error) === "PDKS_SOURCE_STALE") return "Ayarlar değişti. Güncel verilerle yeniden deneyin.";
  if (pdksErrorCode(error) === "PDKS_FORBIDDEN") return "Bu projenin PDKS raporlarını görüntüleme yetkiniz yok.";
  return isPdksBudgetError(error) ? "Okuma sınırı aşıldı. Daha dar bir tarih aralığı seçin." : "Hesaplama tamamlanamadı. Lütfen yeniden deneyin.";
}
