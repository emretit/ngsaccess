import { visitorExpiryError } from "./visitorPresence";

export type VisitorStatus = "active" | "checkedOut" | "expired" | "preRegistered";
export const visitorStatusLabels = {
  active: { label: "Erişim aktif", tone: "success" },
  checkedOut: { label: "Sonlandırıldı / pasif", tone: "neutral" },
  expired: { label: "Süresi doldu", tone: "warning" },
  preRegistered: { label: "Ön kayıt", tone: "neutral" },
} as const;

/** datetime-local girdileri TR saatidir; ofsetli ISO girdiler anı korur. */
export function visitorTime(value: string | undefined): number {
  if (!value) return NaN;
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2}(\.\d{1,3})?)?$/.test(value);
  const normalized = local ? `${value}+03:00` : value;
  if (!local && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const hours = Number(value.slice(11, 13));
  const minutes = Number(value.slice(14, 16));
  if (hours > 23 || minutes > 59) return NaN;
  const time = Date.parse(normalized);
  // Date.parse bazı geçersiz takvim günlerini sonraki aya taşır.
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return NaN;
  return time;
}

export function visitorExpiryValidation(value: string | undefined, now = Date.now()): string | null {
  const time = visitorTime(value);
  return visitorExpiryError(Number.isFinite(time) ? new Date(time).toISOString() : undefined, now);
}

export function visitorStatus(input: { visitorStatus?: string; isActive?: boolean; accessExpiresAt?: string }, now = Date.now()): VisitorStatus {
  if (input.visitorStatus === "checkedOut") return "checkedOut";
  if (input.visitorStatus === "expired" || visitorTime(input.accessExpiresAt) <= now) return "expired";
  if (input.isActive === true) return "active";
  if (input.visitorStatus === "preRegistered") return "preRegistered";
  return "checkedOut";
}

/** Pasif geçmiş kaydı düzenlenebilir; aktivasyon her zaman etkin bitişi doğrular. */
export function visitorUpdateExpiryError(
  current: { isActive?: boolean; accessExpiresAt?: string },
  patch: { isActive?: boolean; accessExpiresAt?: string },
  now = Date.now(),
): string | null {
  const activating = patch.isActive === true && current.isActive !== true;
  const changed = patch.accessExpiresAt !== undefined && patch.accessExpiresAt !== current.accessExpiresAt;
  return activating || changed ? visitorExpiryValidation(patch.accessExpiresAt ?? current.accessExpiresAt, now) : null;
}

export function visitorMatchesSearch(input: { firstName: string; lastName: string; visitorCompany?: string; cardNumber: string }, search?: string): boolean {
  const needle = search?.trim().toLocaleLowerCase("tr") ?? "";
  return !needle || [input.firstName, input.lastName, `${input.firstName} ${input.lastName}`, input.visitorCompany ?? "", input.cardNumber]
    .some(value => value.toLocaleLowerCase("tr").includes(needle));
}

export function maskedVisitorCard(cardNumber: string): string {
  if (cardNumber.startsWith("IADE:")) return "İade edildi";
  return `•••• ${cardNumber.slice(-4)}`;
}

/** Legacy TR wall-clock and current UTC ISO are exposed as one unambiguous instant. */
export function visitorTimeISO(value: string | undefined): string | null {
  const time = visitorTime(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function visitorSensitiveFields(input: { cardNumber: string; tcNo?: string }, canView: boolean) {
  return {
    cardNumber: canView ? input.cardNumber : maskedVisitorCard(input.cardNumber),
    tcNo: input.tcNo ? canView ? input.tcNo : `•••• ${input.tcNo.slice(-4)}` : null,
    sensitiveMasked: !canView,
  };
}

/** Client clocks may differ by at most five minutes from the server clock. */
export function visitorQueryNow(clientNow: number | undefined, serverNow = Date.now()): number {
  const requested = clientNow ?? serverNow;
  if (!Number.isFinite(requested)) throw new Error("Geçersiz sorgu zamanı");
  const tolerance = 5 * 60 * 1000;
  return Math.min(serverNow + tolerance, Math.max(serverNow - tolerance, requested));
}
