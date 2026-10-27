import type { Doc } from "../_generated/dataModel";

export const VISITOR_RETENTION_BATCH_SIZE = 25;
export const VISITOR_RETENTION_PREVIEW_LIMIT = 200;
export const VISITOR_RETENTION_DAY_MS = 86_400_000;

export function validVisitorRetentionDays(days: number | null): boolean {
  return days === null || (Number.isInteger(days) && days >= 30 && days <= 3650);
}

export function visitorRetentionCutoff(days: number, runAt: number): string {
  return new Date(runAt - days * VISITOR_RETENTION_DAY_MS).toISOString();
}

export function shouldPurgeVisitor(
  visitor: Pick<Doc<"employees">, "isVisitor" | "isActive" | "visitorStatus" | "accessExpiresAt" | "updatedAt">,
  days: number | null,
  runAt: number,
): boolean {
  if (days === null || !validVisitorRetentionDays(days) || visitor.isVisitor !== true || visitor.isActive !== false) return false;
  const last = visitor.accessExpiresAt ?? visitor.updatedAt;
  if (!last) return false;
  const endedAt = Date.parse(last);
  return Number.isFinite(endedAt) && endedAt < runAt - days * VISITOR_RETENTION_DAY_MS;
}
