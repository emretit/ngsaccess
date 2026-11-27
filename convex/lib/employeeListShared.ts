/** Versioned Turkish natural keys, with a deterministic Unicode fallback. */
export const EMPLOYEE_LIST_VERSION = 2;
export const employeeSortFields = ["name", "email", "company", "department", "position", "card", "status"] as const;
export type EmployeeSortField = typeof employeeSortFields[number];
export type EmployeeListKeys = Record<`${EmployeeSortField}Asc`, string>;
const alphabet = [...new Set(Array.from(" _-,;:!?.'\"()@*/\\&#%+<=>|~$^£€0123456789abcçdefgğhıijklmnoöpqrsştuüvwxyz"))]
  .sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
const weights = new Map(alphabet.map((char, index) => [char, String(index + 10).padStart(3, "0")]));

export function employeeNaturalKey(value: string): string {
  let primary = "";
  let accents = "";
  let secondary = "";
  for (const token of value.replace(/\u00a0/g, " ").normalize("NFC").match(/[0-9]+|[^0-9]/gu) ?? []) {
    if (/^[0-9]+$/.test(token)) {
      const number = token.replace(/^0+(?=\d)/, "");
      primary += `${weights.get("0")}${String(number.length).padStart(6, "0")}${number}:`;
      continue;
    }
    const lower = token.toLocaleLowerCase("tr");
    const base = lower.normalize("NFD").replace(/\p{M}/gu, "");
    const weight = weights.get(lower) ?? weights.get(base);
    primary += weight ?? `999${String(lower.codePointAt(0) ?? 0).padStart(7, "0")}`;
    accents += weights.has(lower) ? "0000000" : String(lower.codePointAt(0) ?? 0).padStart(7, "0");
    secondary += token === lower ? "0" : "1";
  }
  return `${primary}\u0000${accents}\u0000${secondary}`;
}

export function employeeListKeys(values: Record<EmployeeSortField, string>, id: string): EmployeeListKeys {
  const keys: Partial<EmployeeListKeys> = {};
  for (const field of employeeSortFields) {
    const key = employeeNaturalKey(values[field]);
    keys[`${field}Asc`] = `${key}\u0000${id}`;
  }
  return keys as EmployeeListKeys;
}


/** Minimum structural contract shared by backend documents and frontend rows. */
export type EmployeeListPerson = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  cardNumber: string;
  payrollCode?: string;
  companyId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  isActive?: boolean;
  employmentEndDate?: string;
  companies?: { name: string } | null;
  departments?: { name: string } | null;
  positions?: { name: string } | null;
};
export type EmployeeStatus = "all" | "active" | "inactive" | "terminated";
export function clampPage(page: number, count: number, size: number) {
  return Math.max(
    1,
    Math.min(
      Number.isFinite(page) ? Math.floor(page) : 1,
      Math.max(1, Math.ceil(count / size)),
    ),
  );
}
export function filterAndSortEmployees<T extends EmployeeListPerson>(
  employees: T[],
  q: string,
  department: string,
  status: string,
  sort: string,
  org: { company?: string; position?: string; departmentIds?: readonly string[] } = {},
) {
  const query = q.trim().toLocaleLowerCase("tr");
  const [key, direction] = sort.split(":");
  const value = (employee: EmployeeListPerson): string => {
    switch (key) {
      case "email":
        return employee.email;
      case "company":
        return employee.companies?.name ?? "";
      case "department":
        return employee.departments?.name ?? "";
      case "position":
        return employee.positions?.name ?? "";
      case "card":
        return employee.cardNumber;
      case "status":
        return employee.isActive ? "Aktif" : "Pasif";
      default:
        return `${employee.firstName} ${employee.lastName}`;
    }
  };
  return employees
    .filter(
      (employee) =>
        (!department ||
          (department === "unassigned"
            ? !employee.departmentId
            : org.departmentIds ? !!employee.departmentId && org.departmentIds.includes(employee.departmentId) : employee.departmentId === department)) &&
        (!org.company || employee.companyId === org.company) &&
        (!org.position || employee.positionId === org.position) &&
        (status === "all" ||
          (status === "terminated" ? !!employee.employmentEndDate : status === "active" ? !!employee.isActive : !employee.isActive && !employee.employmentEndDate)) &&
        (!query ||
          [
            employee.firstName,
            employee.lastName,
            `${employee.firstName} ${employee.lastName}`,
            employee.email,
            employee.cardNumber,
            employee.payrollCode ?? "",
          ].some((value) => value.toLocaleLowerCase("tr").includes(query))),
    )
    .sort(
      (a, b) =>
        (direction === "desc" ? -1 : 1) *
          value(a).localeCompare(value(b), "tr", { numeric: true }) ||
        a._id.localeCompare(b._id),
    );
}

export function employeeDepartmentScope(department: string, includeChildren: boolean, departments: readonly { _id: string; parentId?: string }[]): string[] {
  const ids = new Set([department]);
  if (!includeChildren || !department || department === "unassigned") return [...ids];
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of departments) if (row.parentId && ids.has(row.parentId) && !ids.has(row._id)) {
      ids.add(row._id);
      changed = true;
    }
  }
  return [...ids];
}
export function safeSearchParam(value: string) {
  return /^\d{11}$/.test(value.trim()) ? "" : value;
}
