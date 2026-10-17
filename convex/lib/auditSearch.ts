import { AUDIT_TARGET_LABELS } from "./auditLogQuery";

const nameFields = new Set([
  "firstName",
  "lastName",
  "name",
  "title",
  "userName",
]);

function names(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, field]) =>
    nameFields.has(key) && typeof field === "string" ? [field] : [],
  );
}

export function normalizeAuditSearch(value?: string): string {
  return (value ?? "").trim().toLocaleLowerCase("tr-TR").slice(0, 500);
}

export function auditSearchText(args: {
  userName?: string;
  targetTable: string;
  oldValue?: unknown;
  newValue?: unknown;
}): string {
  return normalizeAuditSearch(
    [
      args.userName,
      AUDIT_TARGET_LABELS[args.targetTable] ?? args.targetTable,
      ...names(args.newValue),
      ...names(args.oldValue),
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" "),
  );
}
