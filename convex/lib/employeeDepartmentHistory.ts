import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { trTodayKey } from "./trDate";

type DepartmentSnapshot = { departmentId?: Id<"departments">; companyId?: Id<"companies"> };
export type DepartmentHistoryRow = Pick<Doc<"employeeDepartmentHistory">, "employeeId" | "projectId" | "departmentId" | "validFrom">;

/** The baseline preserves legacy calculations; it does not claim to reconstruct past moves. */
export async function seedDepartmentHistory(ctx: MutationCtx, employee: Doc<"employees">, previous: DepartmentSnapshot = employee): Promise<void> {
  if (!employee.projectId || employee.isVisitor) return;
  if ((previous.departmentId || employee.departmentId) && !employee.hasDepartmentHistory) await ctx.db.patch(employee._id, { hasDepartmentHistory: true });
  const [existing] = await ctx.db.query("employeeDepartmentHistory").withIndex("by_employee_validFrom", q => q.eq("employeeId", employee._id)).take(1);
  if (!existing) await ctx.db.insert("employeeDepartmentHistory", {
    projectId: employee.projectId, employeeId: employee._id, departmentId: previous.departmentId, companyId: previous.companyId,
    validFrom: "0001-01-01", source: "baseline", createdAt: new Date().toISOString(),
  });
}

export async function recordDepartmentChange(ctx: MutationCtx, employeeId: Id<"employees">, previous?: DepartmentSnapshot): Promise<void> {
  const employee = await ctx.db.get(employeeId);
  if (!employee?.projectId || employee.isVisitor) return;
  if (previous && previous.departmentId === employee.departmentId && previous.companyId === employee.companyId) return;
  if (previous) await seedDepartmentHistory(ctx, employee, previous);
  else if (employee.departmentId && !employee.hasDepartmentHistory) await ctx.db.patch(employee._id, { hasDepartmentHistory: true });
  const validFrom = trTodayKey();
  const existing = await ctx.db.query("employeeDepartmentHistory").withIndex("by_employee_validFrom", q => q.eq("employeeId", employeeId).eq("validFrom", validFrom)).unique();
  const fields = { departmentId: employee.departmentId, companyId: employee.companyId };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("employeeDepartmentHistory", { ...fields, projectId: employee.projectId, employeeId, validFrom, source: "change", createdAt: new Date().toISOString() });
}

export async function loadDepartmentHistory(ctx: QueryCtx, employees: readonly Doc<"employees">[]): Promise<DepartmentHistoryRow[]> {
  return (await Promise.all(employees.map(async employee => {
    const rows = await ctx.db.query("employeeDepartmentHistory").withIndex("by_employee_validFrom", q => q.eq("employeeId", employee._id)).take(201);
    if (rows.length > 200) throw new ConvexError("Departman geçmişi okuma sınırı aşıldı (200)");
    return rows.filter(row => row.projectId === employee.projectId);
  }))).flat();
}

export function departmentAt(employee: Pick<Doc<"employees">, "_id" | "projectId" | "departmentId">, date: string, history: readonly DepartmentHistoryRow[]) {
  const rows = history.filter(row => row.employeeId === employee._id && row.projectId === employee.projectId);
  if (!rows.length) return employee.departmentId;
  return rows.filter(row => row.validFrom <= date).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]?.departmentId;
}
