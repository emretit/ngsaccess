/** Son çalışma günü dahildir; eski pasifler geçmiş dönemlere dahil edilmez. */
export type Employment = {
  isActive?: boolean;
  isVisitor?: boolean;
  employmentEndDate?: string;
};

export function employedOn(employee: Employment, dateKey: string): boolean {
  if (employee.isVisitor === true) return employee.isActive === true;
  if (employee.employmentEndDate) return dateKey <= employee.employmentEndDate;
  return employee.isActive === true;
}

export function employedDuring(employee: Employment, startKey: string, endKey: string): boolean {
  return startKey <= endKey && employedOn(employee, startKey);
}
