import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { assertPeopleProject } from "./peopleScope";

type EmployeeRelations = {
  projectId?: Id<"projects">;
  departmentId?: Id<"departments"> | null;
  companyId?: Id<"companies"> | null;
  shiftId?: Id<"shifts"> | null;
  positionId?: Id<"positions"> | null;
  accessRuleId?: Id<"accessRules"> | null;
};

const relationFields = ["departmentId", "companyId", "shiftId", "positionId", "accessRuleId"] as const;

export function employeeRelationsToValidate(current: EmployeeRelations, updates: Partial<EmployeeRelations>): EmployeeRelations {
  const projectChanged = updates.projectId !== undefined && updates.projectId !== current.projectId;
  const merged = { ...current, ...updates };
  const relations: EmployeeRelations = { projectId: updates.projectId ?? current.projectId };
  for (const field of relationFields) {
    if (projectChanged || Object.prototype.hasOwnProperty.call(updates, field)) {
      Object.assign(relations, { [field]: merged[field] });
    }
  }
  return relations;
}

export async function validateEmployeeRelations(ctx: MutationCtx, employee: EmployeeRelations) {
  for (const [id, label] of [
    [employee.departmentId, "Çalışan ve departman"],
    [employee.companyId, "Çalışan ve şirket"],
    [employee.shiftId, "Çalışan ve vardiya"],
    [employee.positionId, "Çalışan ve pozisyon"],
    [employee.accessRuleId, "Çalışan ve erişim kuralı"],
  ] as const) {
    if (!id) continue;
    const related = await ctx.db.get(id);
    if (!related) throw new Error(`${label}: bağlı kayıt bulunamadı`);
    assertPeopleProject(employee.projectId, related.projectId, label);
  }
}
