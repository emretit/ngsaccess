/** Hik person identity survives assigning or replacing a physical card.
 * Missing and whitespace-only identifiers never represent a device person. */
export function hikPersonIdentity(employee: { hikEmployeeNo?: string; cardNumber?: string }): string | undefined {
  return employee.hikEmployeeNo?.trim() || employee.cardNumber?.trim() || undefined;
}
