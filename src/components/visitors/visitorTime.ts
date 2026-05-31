// Ziyaretçi zaman yardımcıları.
// accessExpiresAt ISO UTC olarak saklanır; form <input type="datetime-local"> tarayıcı
// yerel saatiyle çalışır; gösterim daima TR saatiyle (Europe/Istanbul / UTC+3) yapılır.

const pad = (n: number) => String(n).padStart(2, "0");
const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, DST yok

// datetime-local input'u DAİMA TR (UTC+3) duvar-saatiyle çalışır; böylece tablo gösterimi
// (formatVisitorTime, Europe/Istanbul) ile tarayıcı tz'sinden bağımsız tutarlıdır.

/** Bir UTC anını TR duvar-saatli "YYYY-MM-DDTHH:mm" üretir. */
function toTrInput(utcMs: number): string {
  const d = new Date(utcMs + TR_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`;
}

/** ISO UTC → datetime-local input değeri (TR saati). */
export function isoToLocalInput(iso: string): string {
  return toTrInput(new Date(iso).getTime());
}

/** datetime-local input değeri (TR saati) → ISO UTC. */
export function localInputToIso(local: string): string {
  return new Date(`${local}:00+03:00`).toISOString();
}

/** Varsayılan geçerlilik bitişi: şimdiden +8 saat (TR saatiyle datetime-local). */
export function defaultExpiryLocalInput(): string {
  return toTrInput(Date.now() + 8 * 60 * 60 * 1000);
}

/** ISO → TR (UTC+3) gösterim. */
export function formatVisitorTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
