import { classifyReadingSource, type PdksSourceReading } from "./pdksSource";

export type LiveReadingSource = "card" | "qr" | "mobile" | "biometric" | "unknown";
export type ReadingResult = "granted" | "denied" | "unknown";

/** Keep the shared classifier authoritative; PIN/manual have no separate live badge. */
export function liveReadingSource(reading: PdksSourceReading): LiveReadingSource {
  const source = classifyReadingSource(reading);
  return source === "pin" || source === "manual" ? "unknown" : source;
}

export function readingResult(accessStatus?: string): ReadingResult {
  return accessStatus === "izin_verildi" ? "granted"
    : accessStatus === "reddedildi" ? "denied" : "unknown";
}

export function matchesReadingResult(accessStatus: string | undefined, result?: ReadingResult): boolean {
  return result === undefined || readingResult(accessStatus) === result;
}

type WatermarkedReading = { _id: string; _creationTime: number };

/** Receive order, with a deterministic tie break; replacement keeps updated enrichment. */
export function mergeLiveReadings<T extends WatermarkedReading>(
  previous: readonly T[], incoming: readonly T[], limit: number,
): T[] {
  const byId = new Map(previous.map(row => [row._id, row]));
  for (const row of incoming) byId.set(row._id, row);
  return [...byId.values()].sort((a, b) =>
    b._creationTime - a._creationTime || b._id.localeCompare(a._id),
  ).slice(0, limit);
}

/** The caller reads limit + 1 rows. Overflow must trigger reload, never silent catch-up. */
export function liveReadingWindow<T extends WatermarkedReading>(
  candidates: readonly T[], limit: number, afterCreationTime?: number,
): { rows: T[]; latestCreationTime: number | null; hasMore: boolean } {
  const newer = candidates.filter(row => afterCreationTime === undefined || row._creationTime > afterCreationTime);
  const rows = mergeLiveReadings([], newer, limit);
  return {
    rows,
    latestCreationTime: rows[0]?._creationTime ?? afterCreationTime ?? null,
    hasMore: newer.length > limit,
  };
}

export const ASSIGN_CARD_ERRORS = {
  READING_NOT_FOUND: "Bu okuma artık görüntülenemiyor",
  EMPLOYEE_INACTIVE: "Pasif kişiye kart atanamaz",
  EMPLOYEE_NOT_FOUND: "Kişi bulunamadı",
  PROJECT_MISMATCH: "Okuma ve kişi aynı projede olmalı",
  READING_ALREADY_ASSIGNED: "Bu okuma zaten bir kişiyle eşleşmiş",
  INVALID_CARD_SOURCE: "Yalnız fiziksel kart okumalarından kart atanabilir",
  INVALID_CARD_NUMBER: "Okumadaki kart numarası geçerli bir fiziksel kart değil",
  CARD_CHANGED: "Kişinin kartı değişti. Güncel kartı kontrol edip yeniden onaylayın",
  DUPLICATE_CARD: "Bu kart numarası başka bir personelde kullanılıyor",
} as const;

export type AssignCardErrorCode = keyof typeof ASSIGN_CARD_ERRORS;

/** Preserve leading zeroes; reject tokens, URLs, separators and blank/sentinel credentials. */
export function isPhysicalCardNumber(cardNo: string): boolean {
  return /^[A-Za-z0-9_-]{1,32}$/.test(cardNo)
    && !/^(?:0+|unknown|null|undefined|none)$/i.test(cardNo);
}

export function assignmentPrecondition(input: {
  reading: PdksSourceReading & { cardNo: string; employeeId?: string };
  employeeProjectId?: string;
  employeeIsActive?: boolean;
  currentCard: string | null;
  expectedCurrentCard: string | null;
  duplicate: boolean;
}): AssignCardErrorCode | null {
  if (!input.reading.projectId || input.reading.projectId !== input.employeeProjectId) return "PROJECT_MISMATCH";
  if (input.employeeIsActive === false) return "EMPLOYEE_INACTIVE";
  if (input.reading.employeeId) return "READING_ALREADY_ASSIGNED";
  if (classifyReadingSource(input.reading) !== "card") return "INVALID_CARD_SOURCE";
  if (!isPhysicalCardNumber(input.reading.cardNo)) return "INVALID_CARD_NUMBER";
  if (input.currentCard !== input.expectedCurrentCard) return "CARD_CHANGED";
  if (input.duplicate) return "DUPLICATE_CARD";
  return null;
}
