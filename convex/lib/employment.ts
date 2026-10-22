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

/** Ziyaretçi olmayan kişinin son çalışma günü (dahil) geçti mi; ziyaretçiyi erişim penceresi kapatır. */
export function employmentEnded(employee: Employment, todayKey: string): boolean {
  return employee.isVisitor !== true && Boolean(employee.employmentEndDate) && !employedOn(employee, todayKey);
}

export function employedDuring(employee: Employment, startKey: string, endKey: string): boolean {
  return startKey <= endKey && employedOn(employee, startKey);
}
