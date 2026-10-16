export function assertSameProject(employeeProject: string | undefined, targetProject: string | undefined) {
  if (!employeeProject || employeeProject !== targetProject) throw new Error("Çalışan ve departman aynı projede olmalıdır");
}
export function validatePay(...values: (number | null | undefined)[]) {
  if (values.some(value => value != null && (!Number.isFinite(value) || value < 0))) throw new Error("Ücret sonlu ve negatif olmayan bir sayı olmalıdır");
}
export function assertDepartmentEmpty(employeeCount: number, childCount: number) {
  if (employeeCount || childCount) throw new Error(`Departman silinemez: ${employeeCount} çalışan ve ${childCount} alt departman bağlı. Önce bağlı kayıtları taşıyın.`);
}

export const employeeDependentTables = ["employeeAuth", "employeeSessions", "shiftAssignments"] as const;

export const EMPLOYEE_BULK_DELETE_LIMIT = 50;

export function assertEmployeeBulkDeleteLimit(count: number): void {
  if (count > EMPLOYEE_BULK_DELETE_LIMIT) {
    throw new Error(`Bir seferde en fazla ${EMPLOYEE_BULK_DELETE_LIMIT} personel silebilirsiniz. Seçimi azaltın.`);
  }
}
