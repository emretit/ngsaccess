/** Empty addresses have no identity; employees.email remains a required schema string. */
export function normalizeEmployeeEmail(value: string | null | undefined): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}
