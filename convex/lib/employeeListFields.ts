import { withDashboardSummary } from "./dashboardSummary";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { employeeListKeys, EMPLOYEE_LIST_VERSION } from "./employeeListShared";

export async function loadEmployeeOrganizations(ctx: QueryCtx, projectId?: Id<"projects">) {
  const [departments, companies, positions] = await Promise.all([
    ctx.db.query("departments").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001),
    ctx.db.query("companies").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001),
    ctx.db.query("positions").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001),
  ]);
  const complete = [departments, companies, positions].every(rows => rows.length <= 1000);
  return {
    departments: new Map(departments.map(row => [row._id, row])),
    companies: new Map(companies.map(row => [row._id, row])),
    positions: new Map(positions.map(row => [row._id, row])),
    complete,
  };
}
type EmployeeOrganizations = Awaited<ReturnType<typeof loadEmployeeOrganizations>>;

type EmployeeValue = Omit<Doc<"employees">, "_id" | "_creationTime">;
type EmployeePatch = Partial<EmployeeValue>;
async function writerOrganizations(ctx: MutationCtx, employee: Pick<Doc<"employees">, "departmentId" | "companyId">): Promise<EmployeeOrganizations> {
  // Sorting organization IDs needs no project-wide organization reads on writes.
  const department = employee.departmentId && !employee.companyId ? await ctx.db.get(employee.departmentId) : null;
  return {
    departments: new Map(department ? [[department._id, department]] : []),
    companies: new Map(), positions: new Map(), complete: true,
  };
}

/** Private index/search material never becomes part of the person API payload. */
export function publicEmployee<T extends Doc<"employees">>(employee: T) {
  const { listKeys: _keys, listSearch: _search, listVersion: _version, listOrgSignature: _signature, deviceSyncUpdatedAt: _syncTime, ...publicFields } = employee;
  return publicFields;
}

/** All employee writes use one transaction-local writer; optional undefined fields retain deletion semantics. */
export async function patchEmployee(ctx: MutationCtx, employeeId: Id<"employees">, patch: EmployeePatch, refreshKeys = false): Promise<void> {
  ctx = withDashboardSummary(ctx);
  const current = await ctx.db.get(employeeId);
  if (!current) throw new Error("Çalışan bulunamadı");
  const changed = ["projectId", "firstName", "lastName", "email", "cardNumber", "payrollCode", "departmentId", "companyId", "positionId", "isActive", "isVisitor"] as const;
  // Person/card payload freshness only; biometric delivery has its own status readers.
  const deviceFields = ["projectId", "cardNumber", "hikEmployeeNo", "hikCardless", "firstName", "lastName", "isActive", "accessStartsAt", "accessExpiresAt", "employmentEndDate", "photoStorageId", "photoUrl"] as const;
  if (deviceFields.some(key => Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== current[key])) patch = { ...patch, deviceSyncUpdatedAt: Date.now() };
  // Freeze legacy freshness before unrelated edits move updatedAt forward.
  else if (current.deviceSyncUpdatedAt === undefined && patch.updatedAt !== undefined) patch = { ...patch, deviceSyncUpdatedAt: Date.parse(current.updatedAt ?? "") || current._creationTime };
  const next = { ...current, ...patch };
  const org = await writerOrganizations(ctx, next);
  const needsKeys = refreshKeys || current.listVersion !== EMPLOYEE_LIST_VERSION || !current.listKeys || changed.some(key => Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== current[key]);
  if (!needsKeys) return ctx.db.patch(employeeId, patch);
  await ctx.db.patch(employeeId, { ...patch, ...employeeIndexFields(next, org) });
}

export async function insertEmployee(ctx: MutationCtx, value: EmployeeValue): Promise<Id<"employees">> {
  ctx = withDashboardSummary(ctx);
  const employeeId = await ctx.db.insert("employees", { ...value, deviceSyncUpdatedAt: value.deviceSyncUpdatedAt ?? Date.now() });
  const org = await writerOrganizations(ctx, value);
  await ctx.db.patch(employeeId, employeeIndexFields({ ...value, _id: employeeId, _creationTime: 0 }, org));
  return employeeId;
}

export function employeeIndexFields(emp: Doc<"employees">, org: EmployeeOrganizations) {
  const department = emp.departmentId ? org.departments.get(emp.departmentId) : undefined;
  const companyId = emp.companyId ?? department?.companyId;
  const scope = `${EMPLOYEE_LIST_VERSION}:${emp.isVisitor === true ? "V" : "E"}\u0000`;
  const keys = employeeListKeys({
    name: `${emp.firstName} ${emp.lastName}`, email: emp.email, card: emp.cardNumber,
    department: "", company: "", position: "", status: emp.isActive ? "Aktif" : "Pasif",
  }, emp._id);
  const listKeys = Object.fromEntries(Object.entries(keys).map(([key, value]) => [key, `${scope}${value}`])) as typeof keys;
  // Resolve current organization names when querying, so a rename never invalidates employee keys.
  listKeys.departmentAsc = `${scope}${emp.departmentId ?? ""}\u0000${emp._id}`;
  listKeys.companyAsc = `${scope}${companyId ?? ""}\u0000${emp._id}`;
  listKeys.positionAsc = `${scope}${emp.positionId ?? ""}\u0000${emp._id}`;
  return {
    listVersion: EMPLOYEE_LIST_VERSION, listOrgSignature: undefined, listKeys,
    listSearch: [emp.firstName, emp.lastName, `${emp.firstName} ${emp.lastName}`, emp.email, emp.cardNumber, emp.payrollCode ?? ""].join("\u0000").toLocaleLowerCase("tr"),
  };
}
