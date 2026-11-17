import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { resolveEmployeeIdeDeviceIds, reconcileRemovedEmployeeIde } from "./accessGraph";
import { snapshotEmployeeHikDevices, reconcileRemovedEmployeeHik } from "./peopleHikSnapshot";

export const departmentSelectionValidator = v.object({ departmentId: v.id("departments"), includeChildren: v.boolean() });
export type DepartmentSelection = Infer<typeof departmentSelectionValidator>;
const MAX_MEMBERS = 500;
function checked<T>(rows: T[], max: number, name: string): T[] {
  if (rows.length > max) throw new ConvexError(`${name} sınırı aşıldı (${max}); kapsamı daraltın`);
  return rows;
}

export async function departmentMemberIds(ctx: QueryCtx, projectId: Id<"projects">, selections: readonly DepartmentSelection[]) {
  checked([...selections], 100, "Departman seçimi");
  const departments = new Set<Id<"departments">>();
  for (const selection of selections) {
    const root = await ctx.db.get(selection.departmentId);
    if (!root || root.projectId !== projectId) throw new ConvexError("Departman bu projede bulunamadı");
    departments.add(root._id);
    if (!selection.includeChildren) continue;
    const queue = [root._id];
    const visited = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      const children = checked(await ctx.db.query("departments").withIndex("by_parent", q => q.eq("parentId", queue[i])).take(1001), 1000, "Alt departman");
      for (const child of children) {
        if (child.projectId !== projectId || visited.has(child._id)) continue;
        visited.add(child._id); queue.push(child._id); departments.add(child._id);
        checked(queue, 1000, "Alt departman");
      }
    }
  }
  const ids = new Set<Id<"employees">>();
  for (const departmentId of departments) {
    const employees = checked(await ctx.db.query("employees").withIndex("by_department", q => q.eq("departmentId", departmentId)).take(MAX_MEMBERS + 1), MAX_MEMBERS, "Departman kişi");
    for (const employee of employees) if (employee.projectId === projectId && !employee.isVisitor && employee.isActive !== false) ids.add(employee._id);
    checked([...ids], MAX_MEMBERS, "Kural kişi");
  }
  return [...ids];
}

/** Explicit selections only: never infer a department from existing person links. */
export async function writeRuleDepartments(ctx: MutationCtx, groupId: Id<"accessRules">, projectId: Id<"projects">, selections: readonly DepartmentSelection[]) {
  const unique = new Map(selections.map(selection => [selection.departmentId, selection]));
  checked([...unique.values()], 100, "Departman seçimi");
  const previous = checked(await ctx.db.query("groupDepartments").withIndex("by_group", q => q.eq("groupId", groupId)).take(101), 100, "Departman seçimi");
  for (const link of previous) await ctx.db.delete(link._id);
  for (const selection of unique.values()) await ctx.db.insert("groupDepartments", { ...selection, groupId, projectId });
}

/** Called in the person's write transaction; only inherited links can be removed. */
export async function reconcileEmployeeDepartmentRules(ctx: MutationCtx, employeeId: Id<"employees">): Promise<void> {
  const employee = await ctx.db.get(employeeId);
  if (!employee?.projectId || employee.isVisitor) return;
  const projectId = employee.projectId;
  const selections = checked(await ctx.db.query("groupDepartments").withIndex("by_project", q => q.eq("projectId", projectId)).take(501), 500, "Proje departman kuralı");
  const members = checked(await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employeeId)).take(101), 100, "Kişi kuralı");
  if (!selections.length && !members.some(member => member.source === "department")) return;
  const ancestors = new Set<Id<"departments">>();
  let next = employee.departmentId;
  while (next) {
    if (ancestors.has(next) || ancestors.size >= 50) throw new ConvexError("Departman ağacı geçersiz");
    const department: Doc<"departments"> | null = await ctx.db.get(next);
    if (!department || department.projectId !== projectId) break;
    ancestors.add(next); next = department.parentId;
  }
  const expected = new Set<Id<"accessRules">>();
  if (employee.isActive !== false) for (const selection of selections) {
    if (selection.departmentId !== employee.departmentId && !(selection.includeChildren && ancestors.has(selection.departmentId))) continue;
    const rule = await ctx.db.get(selection.groupId);
    if (rule?.projectId === projectId && rule.targetType !== "visitor") expected.add(rule._id);
  }
  const removed = members.filter(member => member.source === "department" && !expected.has(member.groupId));
  const added = [...expected].filter(groupId => !members.some(member => member.groupId === groupId));
  if (!removed.length && !added.length) return;
  const hik = await snapshotEmployeeHikDevices(ctx, employee);
  const ide = await resolveEmployeeIdeDeviceIds(ctx, employeeId, projectId);
  const now = new Date().toISOString();
  for (const member of removed) await ctx.db.delete(member._id);
  for (const groupId of added) {
    const groupMembers = await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", groupId)).take(MAX_MEMBERS);
    if (groupMembers.length >= MAX_MEMBERS) throw new ConvexError(`Kural kişi sınırı aşıldı (${MAX_MEMBERS})`);
    await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, source: "department", createdAt: now });
  }
  await reconcileRemovedEmployeeHik(ctx, employeeId, hik);
  await reconcileRemovedEmployeeIde(ctx, { employeeId, projectId, candidatePanels: ide });
  await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
}
