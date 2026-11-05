import { isValidTurkishIdentityNumber } from "./employeeImportValidation";

/** Form ve sunucu aynı metni gösterir; 11 hane + doğrulama haneleri (Excel aktarımıyla aynı kural). */
export const TC_NO_INVALID_MESSAGE = "Geçerli bir TC Kimlik No girin (11 hane, doğrulama haneleri tutmalı)";
export function assertSameProject(employeeProject: string | undefined, targetProject: string | undefined) {
  if (!employeeProject || employeeProject !== targetProject) throw new Error("Çalışan ve departman aynı projede olmalıdır");
}
export function validatePay(...values: (number | null | undefined)[]) {
  if (values.some(value => value != null && (!Number.isFinite(value) || value < 0))) throw new Error("Ücret sonlu ve negatif olmayan bir sayı olmalıdır");
}
type EmployeeTextFields = { firstName?: string; lastName?: string; email?: string; tcNo?: string | null; cardNumber?: string };
/** Personel formu kurallarının sunucu karşılığı; yalnız verilen alanlar denetlenir (güncellemede değişenler). E-posta isteğe bağlıdır. */
export function validateEmployeeText(fields: EmployeeTextFields) {
  if (fields.firstName !== undefined && !fields.firstName.trim()) throw new Error("Ad alanı zorunludur");
  if (fields.lastName !== undefined && !fields.lastName.trim()) throw new Error("Soyad alanı zorunludur");
  if (fields.cardNumber !== undefined && !fields.cardNumber.trim()) throw new Error("Kart numarası zorunludur");
  const email = fields.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Geçerli bir e-posta adresi girin");
  const tcNo = fields.tcNo?.trim();
  if (tcNo && !isValidTurkishIdentityNumber(tcNo)) throw new Error(TC_NO_INVALID_MESSAGE);
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
