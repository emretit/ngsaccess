/** Operational employee changes only. Profile, credential, pay and free-text copies are excluded. */
const EMPLOYEE_AUDIT_FIELDS = new Set([
  "isActive", "isVisitor", "visitorStatus", "departmentId", "companyId", "positionId", "shiftId", "accessRuleId",
  "accessStartsAt", "accessExpiresAt", "employmentEndDate", "terminationType", "sgkExitCode", "terminatedAt", "terminatedBy",
  "transferredToEmployeeId", "transferredFromEmployeeId", "employeeId", "imported", "skipped", "errors", "assigned",
  "anonymized", "deleted", "count", "retentionDays", "importedCount", "createdCount", "updatedCount",
  "exported", "readingId", "cardChanged",
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function pick(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return;
  const safe: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (EMPLOYEE_AUDIT_FIELDS.has(key) && (typeof field === "string" || typeof field === "number" || typeof field === "boolean" || field === null)) safe[key] = field;
    if (key === "cascade" && isRecord(field)) safe.cascade = Object.fromEntries(Object.entries(field).filter(([, count]) => typeof count === "number" || typeof count === "boolean"));
  }
  return Object.keys(safe).length ? safe : undefined;
}
export function employeeAuditValues(oldValue: unknown, newValue: unknown, action: string) {
  let oldSafe = pick(oldValue);
  let newSafe = pick(newValue);
  if (action === "update" && isRecord(newValue)) {
    // newValue may be a patch: absent fields are not interpreted as deletions.
    const changed = Object.keys(newValue).filter(key => JSON.stringify(isRecord(oldValue) ? oldValue[key] : undefined) !== JSON.stringify(newValue[key]));
    oldSafe = oldSafe ? Object.fromEntries(Object.entries(oldSafe).filter(([key]) => changed.includes(key))) : undefined;
    newSafe = newSafe ? Object.fromEntries(Object.entries(newSafe).filter(([key]) => changed.includes(key))) : undefined;
    if (Object.prototype.hasOwnProperty.call(newValue, "cardNumber") && (!isRecord(oldValue) || oldValue.cardNumber !== newValue.cardNumber)) {
      newSafe = { ...newSafe, cardChanged: true };
    }
  }
  return { oldValue: oldSafe && Object.keys(oldSafe).length ? oldSafe : undefined, newValue: newSafe && Object.keys(newSafe).length ? newSafe : undefined };
}
export function safeAuditRow<T extends { targetTable: string; action: string; oldValue?: unknown; newValue?: unknown }>(row: T): T {
  return row.targetTable === "employees" ? { ...row, ...employeeAuditValues(row.oldValue, row.newValue, row.action) } : row;
}
