export type EmployeeImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  tcNo?: string;
  payrollCode?: string;
  cardNumber: string;
  department?: string;
  position?: string;
  company?: string;
  isActive?: boolean;
};

export function normalizeEmployeeImportName(value: string): string {
  return value.trim().normalize("NFC").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

export function validateEmployeeImportRow(row: EmployeeImportRow): string[] {
  const errors: string[] = [];
  if (row.firstName.length > 256) errors.push("Ad en fazla 256 karakter olabilir");
  if (row.lastName.length > 256) errors.push("Soyad en fazla 256 karakter olabilir");
  if (!row.firstName.trim()) errors.push("Ad zorunludur");
  if (!row.lastName.trim()) errors.push("Soyad zorunludur");
  if (!row.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) errors.push("Geçerli e-posta zorunludur");
  if (!row.cardNumber.trim() || row.cardNumber.length > 128) errors.push("Geçerli kart numarası zorunludur");
  if (row.tcNo && !isValidTurkishIdentityNumber(row.tcNo)) errors.push("T.C. Kimlik No geçersiz");
  return errors;
}

export function isValidTurkishIdentityNumber(value: string): boolean {
  if (!/^\d{11}$/.test(value) || value[0] === "0") return false;
  const digits = [...value].map(Number);
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  return (odd * 7 - even) % 10 === digits[9] && digits.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === digits[10];
}

export function findDuplicateImportRows(rows: readonly EmployeeImportRow[]): Map<number, string> {
  const seen = new Map<string, number>();
  const duplicates = new Map<number, string>();
  for (const row of rows) {
    for (const [label, value] of [["T.C. Kimlik No", row.tcNo], ["E-posta", row.email], ["Kart No", row.cardNumber]] as const) {
      const trimmed = value?.trim();
      const key = label === "E-posta" ? trimmed?.toLowerCase() : trimmed;
      if (!key) continue;
      const signature = `${label}:${key}`;
      const previous = seen.get(signature);
      if (previous !== undefined) duplicates.set(row.rowNumber, `${label}, ${previous}. satırda da kullanılıyor`);
      else seen.set(signature, row.rowNumber);
    }
  }
  return duplicates;
}
