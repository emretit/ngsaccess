import { toUtcISO } from "./trDate";

/**
 * Kişinin cihazda yazılacak erişim bitişi (UTC epoch ms); yoksa undefined = cihazda sınırsız.
 * - Ziyaretçi `accessExpiresAt`: o an (ofsetsiz eski değer TR saati, toUtcISO ile aynı ayrıştırma).
 * - Ayrılan `employmentEndDate` (YYYY-MM-DD, son çalışma günü dahil — cron `employmentEndDate < today`
 *   ile kapatır): o günün TR 23:59:59.999'u.
 * İkisi de varsa erken olan. Geçmişte kalmış bitiş de döner; cihaz çağıranı (Hik begin/end sırası vb.) karar verir.
 */
export function accessEndsAtMs(person: { accessExpiresAt?: string; employmentEndDate?: string }): number | undefined {
  // Ofsetsiz değer TR saati sayılır; geçersiz takvim günü (2026-02-30) undefined döner, fırlatmaz.
  const ends = [
    person.accessExpiresAt ? toUtcISO(person.accessExpiresAt) : undefined,
    person.employmentEndDate && /^\d{4}-\d{2}-\d{2}$/.test(person.employmentEndDate)
      ? toUtcISO(`${person.employmentEndDate}T23:59:59.999`)
      : undefined,
  ].flatMap(iso => iso ? [Date.parse(iso)] : []);
  return ends.length ? Math.min(...ends) : undefined;
}
