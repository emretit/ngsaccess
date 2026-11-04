import type { Doc, Id } from "../_generated/dataModel";
import { cardNumericKey } from "./cardIdentity";
import { MAX_FINGERPRINTS_PER_EMPLOYEE } from "./fingerprintSlots";
import { toUtcISO } from "./trDate";

export type ImportPerson = {
  employeeNo: string; name: string; cards: string[]; fingerCount: number;
  valid?: { enable?: boolean; beginTime?: string; endTime?: string; timeType?: string };
  doorRight?: string;
  rightPlans?: { doorNo: number; planTemplateNo: string }[];
};

/** Preserve device validity; missing/malformed enabled intervals fail closed. */
export function importedValidity(valid: ImportPerson["valid"], now: number) {
  // Disabled validity means the device ignores its (often stale) date fields.
  if (valid?.enable === false) return { isActive: true };
  const utc = (value?: string) => value ? toUtcISO(valid?.timeType === "UTC" && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? `${value}Z` : value) : undefined;
  const accessStartsAt = utc(valid?.beginTime);
  const accessExpiresAt = utc(valid?.endTime);
  const intervalValid = !!accessStartsAt && !!accessExpiresAt && accessStartsAt < accessExpiresAt;
  return {
    isActive: intervalValid && Date.parse(accessExpiresAt) > now,
    ...(accessStartsAt ? { accessStartsAt } : {}),
    ...(accessExpiresAt ? { accessExpiresAt } : {}),
  };
}
export type ImportRow = ImportPerson & { status: "new" | "matched" | "conflict" | "manual"; matchedEmployeeId?: Id<"employees">; storedFingerCount?: number; reason?: string };
export function classifyImportPerson(person: ImportPerson, projectId: Id<"projects">, duplicates: readonly Pick<Doc<"employees">, "_id" | "cardNumber" | "projectId">[]): ImportRow {
  const identities = [person.employeeNo, ...person.cards];
  const equivalent = (left: string, right: string) => left === right || (cardNumericKey(left) !== null && cardNumericKey(left) === cardNumericKey(right));
  const relevant = duplicates.filter(employee => identities.some(card => equivalent(employee.cardNumber, card)));
  const match = relevant.find(employee => employee.cardNumber === person.employeeNo && employee.projectId === projectId);
  if (relevant.some(employee => employee._id !== match?._id)) return { ...person, status: "conflict", reason: "Kart numarası başka bir kayıtta kullanılıyor." };
  if (match) return { ...person, status: "matched", matchedEmployeeId: match._id };
  if (person.cards.length > 1 || (person.cards.length === 1 && person.cards[0] !== person.employeeNo)) return { ...person, status: "manual", reason: "Cihaz kişi numarası ve kartları elle eşleştirilmeli." };
  return { ...person, status: "new" };
}
export function splitDevicePersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" } : { firstName: parts[0] ?? "", lastName: "" };
}
export function selectImportFingerprints<T extends { fingerPrintID: number }>(templates: readonly T[]): { accepted: T[]; skipped: number } {
  const accepted: T[] = [];
  const seen = new Set<number>();
  for (const template of templates) {
    const id = template.fingerPrintID;
    if (!Number.isInteger(id) || id < 1 || id > 10 || seen.has(id) || accepted.length >= MAX_FINGERPRINTS_PER_EMPLOYEE) continue;
    seen.add(id); accepted.push(template);
  }
  return { accepted, skipped: templates.length - accepted.length };
}
