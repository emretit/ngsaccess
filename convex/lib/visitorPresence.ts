export const VISITOR_PRESENCE_READING_LIMIT = 50;

export interface PresenceReading {
  accessTime: string;
  accessStatus?: string;
  direction?: string;
}

/** Ret veya bilinmeyen yön konum kanıtı değildir; teslim sırası olay sırası değildir. */
export function visitorPresence(readings: readonly PresenceReading[]) {
  let latest: PresenceReading | undefined;
  for (const reading of readings) {
    if (reading.accessStatus !== "izin_verildi" || !["entry", "exit"].includes(reading.direction ?? "")) continue;
    const time = Date.parse(reading.accessTime);
    if (!Number.isFinite(time)) continue;
    if (!latest || time > Date.parse(latest.accessTime)) latest = reading;
    // Aynı anın çelişkili yönleri için aşağıda bilinmiyor döndürülür.
  }
  if (!latest) return { lastDirection: null, lastReadingAt: null, presence: "unknown" as const };
  const conflict = readings.some((r) => r.accessStatus === "izin_verildi" && Date.parse(r.accessTime) === Date.parse(latest.accessTime) && ["entry", "exit"].includes(r.direction ?? "") && r.direction !== latest.direction);
  return {
    lastDirection: conflict ? null : latest.direction ?? null,
    lastReadingAt: latest.accessTime,
    presence: conflict ? "unknown" as const : latest.direction === "entry" ? "inside" as const : "outside" as const,
  };
}

export function visitorExpiryError(value: string | undefined, now = Date.now()): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return "Geçerli bir bitiş zamanı girin";
  if (Date.parse(value) <= now) return "Geçerlilik bitişi gelecekte olmalıdır";
  return null;
}

export function visitorDetailsError(input: { firstName: string; lastName: string; cardNumber: string; isActive?: boolean; accessExpiresAt?: string }, now = Date.now(), validateExpiry = true): string | null {
  if (!input.firstName.trim()) return "Ad alanı zorunludur";
  if (!input.lastName.trim()) return "Soyad alanı zorunludur";
  if (!input.cardNumber.trim() || input.cardNumber.trim().startsWith("IADE:")) return "Geçerli yeni bir kart numarası girin";
  return validateExpiry ? visitorExpiryError(input.accessExpiresAt, now) : null;
}
