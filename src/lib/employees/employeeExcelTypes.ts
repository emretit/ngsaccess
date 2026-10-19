export interface EmployeeImportRow {
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
}

export interface EmployeeImportIssue {
  rowNumber: number;
  message: string;
}

export interface ParsedEmployeeFile {
  rows: EmployeeImportRow[];
  issues: EmployeeImportIssue[];
}
