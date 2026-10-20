import type { VisitorDetail } from "@/types/visitor";

/** UI eligibility only; the mutation verifies the mobile origin and project. */
export function canAssignVisitorPreset(visitor?: VisitorDetail | null): boolean {
  return visitor?.isActive === false && (visitor.status === "preRegistered" || visitor.status === "expired") &&
    visitor.presetRuleId === null && visitor.cardNumber.startsWith("PRE:");
}

export function isVisitorCardPlaceholder(cardNumber: string): boolean {
  const card = cardNumber.trim();
  return card.startsWith("PRE:") || card.startsWith("IADE:") || card.includes("•");
}
