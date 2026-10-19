export interface CardAssignmentRow {
  employeeId: string;
  employeeName: string;
  cardNumber: string;
  status?: "assigned" | "error";
  message?: string;
}

export interface PasteDistribution {
  rows: CardAssignmentRow[];
  rejected: string[];
}

export function validateCardNumber(cardNumber: string, rows: CardAssignmentRow[], employeeId: string): string | null {
  const value = cardNumber.trim();
  if (!value) return "Kart numarası boş olamaz";
  if (value.length > 128 || !/^[\w-]+$/.test(value)) return "Kart numarası biçimi geçersiz";
  if (rows.some((row) => row.employeeId !== employeeId && row.cardNumber.trim() === value)) return "Bu kart başka bir satırda kullanılıyor";
  return null;
}

export function distributePastedCards(rows: CardAssignmentRow[], pasted: string): PasteDistribution {
  const nextRows = rows.map((row) => ({ ...row }));
  const rejected: string[] = [];
  const values = pasted.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  for (const value of values) {
    const emptyIndex = nextRows.findIndex((row) => !row.cardNumber.trim());
    if (emptyIndex < 0) {
      rejected.push(value);
      continue;
    }
    const target = nextRows[emptyIndex];
    if (!target) {
      rejected.push(value);
      continue;
    }
    const error = validateCardNumber(value, nextRows, target.employeeId);
    if (error) {
      rejected.push(value);
      continue;
    }
    nextRows[emptyIndex] = { ...target, cardNumber: value, status: undefined, message: undefined };
  }
  return { rows: nextRows, rejected };
}

export function nextEmptyCardAssignment(rows: CardAssignmentRow[]): number {
  return rows.findIndex((row) => !row.cardNumber.trim());
}

export function mergeAssignmentResults(rows: CardAssignmentRow[], results: { employeeId: string; status: "assigned" | "error"; message: string }[]): CardAssignmentRow[] {
  const byEmployee = new Map(results.map((result) => [result.employeeId, result]));
  return rows.map((row) => {
    const result = byEmployee.get(row.employeeId);
    return result ? { ...row, status: result.status, message: result.message } : row;
  });
}

export function assignReadCard(rows: CardAssignmentRow[], cardNumber: string): { rows: CardAssignmentRow[]; message: string } {
  const index = nextEmptyCardAssignment(rows);
  if (index < 0) return { rows, message: "Kartı olmayan tüm kişilere kart girildi." };
  const target = rows[index];
  if (!target) return { rows, message: "Boş satır bulunamadı." };
  const error = validateCardNumber(cardNumber, rows, target.employeeId);
  if (error) return { rows, message: error };
  return {
    rows: rows.map((row, rowIndex) => rowIndex === index ? { ...row, cardNumber: cardNumber.trim(), status: undefined, message: undefined } : row),
    message: "Okunan kart sıradaki boş kişiye eklendi.",
  };
}
