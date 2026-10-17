import { parseCardReaderBody } from "./cardReaderParse";
import type { Doc } from "../_generated/dataModel";

export type PdksReadingSource = "card" | "pin" | "qr" | "mobile" | "manual" | "biometric" | "unknown";
export type PdksSourceReading = Partial<Pick<Doc<"cardReadings">,
  "projectId" | "cardNo" | "rawData" | "ideIoId" | "hikCurrentVerifyMode" | "hikMajorEventType" | "hikSubEventType" | "hikDevIndex" | "hikSerialNo" | "hikFrontSerialNo" | "hikDateTime" | "hikPictureURL"
>>;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

const CARD_MINORS: ReadonlySet<number> = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x07, 0x08, 0x09, 0x0c, 0x77, 0xa2, 0xa3]);
const PIN_MINORS: ReadonlySet<number> = new Set([0x0e, 0x65, 0x66, 0x67, 0x94, 0x96, 0x97, 0xb5]);
const QR_MINORS: ReadonlySet<number> = new Set([0x9c, 0x9d, 0xb3, 0xb4]);
const MOBILE_MINORS: ReadonlySet<number> = new Set([0x9f, 0xa0]);
/** Liveness/iris minors outside the contiguous fingerprint (0x26–31) and face/fingerprint (0x36–50) ranges. */
const EXTRA_BIOMETRIC_MINORS: ReadonlySet<number> = new Set([0x68, 0x69, 0x70, 0xbe, 0xbf, 0xc0, 0xca, 0xcb]);

function knownNonBiometricMinor(minor: number): PdksReadingSource | undefined {
  if (CARD_MINORS.has(minor)) return "card";
  if (PIN_MINORS.has(minor)) return "pin";
  if (QR_MINORS.has(minor)) return "qr";
  if (MOBILE_MINORS.has(minor)) return "mobile";
  return undefined;
}

/** Only explicit event evidence classifies biometrics; a card number is not proof of card authentication. */
export function classifyReadingSource(reading: PdksSourceReading): PdksReadingSource {
  const parsed = reading.rawData ? parseCardReaderBody(reading.rawData, null) : undefined;
  const rawMode = String(reading.hikCurrentVerifyMode ?? parsed?.hikCurrentVerifyMode ?? "");
  const mode = rawMode.toLowerCase().replace(/[^a-z]/g, "");
  // Hik modes are camelCase ("cardOrFace"); "or" inside a word ("password") is not an alternative.
  const orMode = /Or(?=[A-Z])|(^|[^A-Za-z])(or|OR)([^A-Za-z]|$)/.test(rawMode);
  const major = reading.hikMajorEventType ?? parsed?.hikMajorEventType;
  const minor = reading.hikSubEventType ?? parsed?.hikSubEventType;
  const accessEvent = major === 5 || major === 1;
  // Catalog: fingerprint 0x26–31, mixed face/fingerprint 0x36–50, liveness/iris.
  const biometricMinor = typeof minor === "number" && accessEvent && (
    (minor >= 0x26 && minor <= 0x31) || (minor >= 0x36 && minor <= 0x50) || EXTRA_BIOMETRIC_MINORS.has(minor)
  );
  if (biometricMinor) return "biometric";
  // currentVerifyMode is the reader's configured mode: in "cardOrFace" a known card/PIN minor proves no biometric
  // factor was used; any "and" combination or an unproven factor stays biometric.
  const minorSource = accessEvent && typeof minor === "number" ? knownNonBiometricMinor(minor) : undefined;
  const minorDecides = orMode && !mode.includes("and") && minorSource !== undefined;
  if (/face|finger|fp|iris|palm|biometric/.test(mode) && !minorDecides) return "biometric";
  // /card-reader treats UUID credentials as mobile QR tokens and stores the employee's cardNo.
  const credential = parsed?.user_id ?? reading.cardNo;
  if (typeof credential === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(credential)) return "qr";
  if (minorSource) return minorSource;
  if (mode.includes("card")) return "card";
  if (/pin|password|pwd/.test(mode)) return "pin";
  if (/qr|qrcode/.test(mode)) return "qr";
  if (/mobile|bluetooth/.test(mode)) return "mobile";
  const isHik = major !== undefined || minor !== undefined || !!reading.hikDevIndex || reading.hikSerialNo !== undefined || reading.hikFrontSerialNo !== undefined || !!reading.hikDateTime || !!reading.hikPictureURL || !!parsed?.hikDevIndex || parsed?.hikSerialNo !== undefined || !!mode;
  if (isHik) return "unknown";
  // Parsed lazily: Hik/biometric/UUID rows return above without needing a second JSON.parse.
  let raw: Record<string, unknown> = {};
  try { raw = object(JSON.parse(reading.rawData ?? "{}")); } catch { /* Legacy text markers. */ }
  if (reading.rawData?.startsWith("qr_checkin") || raw.source === "mobile_qr" || raw.source === "qr") return "qr";
  if (raw.source === "mobile" || raw.source === "mobile_checkin") return "mobile";
  if (raw.source === "manual") return "manual";
  const payload = object(raw.payload);
  if ([payload.verifyMode, payload.method, raw.source].some(value => typeof value === "string" && /^(pin|password)$/i.test(value))) return "pin";
  if (reading.ideIoId !== undefined || parsed?.ideIoId !== undefined || object(raw.transaction).type === "access_event") return "card";
  // Legacy non-Hik card-reader rows contain only a card number.
  return reading.cardNo?.trim() ? "card" : "unknown";
}

/** Unknown legacy events remain eligible, but never get relabeled as cards/biometrics. */
export function isPdksEligibleReading(reading: PdksSourceReading): boolean {
  return classifyReadingSource(reading) !== "biometric";
}

/** Shared calculation boundary. An explicit project excludes unassigned and foreign rows too. */
export function filterPdksReadings<T extends PdksSourceReading>(readings: readonly T[], projectId?: string): T[] {
  return readings.filter(reading =>
    (projectId === undefined || reading.projectId === projectId) && isPdksEligibleReading(reading));
}

export function countPdksReadingSources(readings: readonly PdksSourceReading[]): Record<PdksReadingSource, number> {
  const counts: Record<PdksReadingSource, number> = { card: 0, pin: 0, qr: 0, mobile: 0, manual: 0, biometric: 0, unknown: 0 };
  for (const reading of readings) counts[classifyReadingSource(reading)] += 1;
  return counts;
}
