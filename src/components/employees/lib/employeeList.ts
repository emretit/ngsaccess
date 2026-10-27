import type { EmploymentEmployee as Employee } from "./employment";
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
export function filterAndSortEmployees(
  employees: Employee[],
  q: string,
  department: string,
  status: string,
  sort: string,
  org: { company?: string; position?: string } = {},
) {
  const query = q.trim().toLocaleLowerCase("tr");
  const [key, direction] = sort.split(":");
  const value = (employee: Employee): string => {
    switch (key) {
      case "email":
        return employee.email;
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
            : employee.departmentId === department)) &&
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
export function safeSearchParam(value: string) {
  return /^\d{11}$/.test(value.trim()) ? "" : value;
}
