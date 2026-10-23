/**
 * Sanal okuyucu: girişteki tablet/telefon tarayıcısında çalışan genel QR okuyucu.
 * Ayrı tablo yok — `devices` satırı (marka "other" + bu tip) ve /card-reader ile aynı
 * apiToken'ı kullanır; çalışanın mobil uygulamadaki tek kullanımlık QR'ını okur.
 */
export const VIRTUAL_READER_TYPE = "Sanal Okuyucu";

/** Okuyucu ekranı bu aralıkla yoklama yapar; çevrimiçi penceresi (5 dk) içinde kalır. */
export const VIRTUAL_READER_HEARTBEAT_MS = 2 * 60 * 1000;

export const READER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVirtualReader(device: { brand?: string | null; deviceType?: string | null }): boolean {
  return device.brand === "other" && device.deviceType === VIRTUAL_READER_TYPE;
}

/** Token URL parçasında (#) taşınır: sunucu/proxy loglarına ve Referer'a düşmez. */
export function virtualReaderPath(readerToken: string): string {
  return `/reader#${readerToken}`;
}

export type ReaderScanDenial = "TOKEN_INVALID" | "TOKEN_USED" | "TOKEN_EXPIRED" | "SESSION_INVALID" | "NOT_ALLOWED";
