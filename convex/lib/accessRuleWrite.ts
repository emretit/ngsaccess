import { requirePermission } from "./permissions";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { validateAccessRelations } from "./accessScopeRelations";
import { assertAccessSchedule } from "./accessRuleUx";
import { resolveProjectScope } from "./projectScope";
import { departmentMemberIds, writeRuleDepartments, type DepartmentSelection } from "./departmentAccess";
import { writeAudit } from "./audit";

type CreateAccessRuleWithGroupsArgs = {
  name: string;
  projectId?: Id<"projects">;
  targetType?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  days?: string[];
  priority?: number;
  accessDirection?: string;
  isActive?: boolean;
  employeeIds?: Id<"employees">[];
  deviceIds?: Id<"devices">[];
  doorIds?: Id<"doors">[];
  departmentSelections?: DepartmentSelection[];
};

/** Called only by accessRules.createWithGroups after authorization. */
export async function createAccessRuleWithGroups(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: CreateAccessRuleWithGroupsArgs,
): Promise<Id<"accessRules">> {
  await resolveProjectScope(ctx, args.projectId);
  if (!args.projectId) throw new Error("Önce bir proje seçin");
  await requirePermission(ctx, ctx.user, args.projectId, "accessRules.manage");
  const ruleId = await insertAccessRuleWithGroups(ctx, args);
  await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "create", targetTable: "accessRules", targetId: ruleId,
    newValue: { name: args.name, days: args.days, startTime: args.startTime, endTime: args.endTime, deviceCount: args.deviceIds?.length ?? 0,
      doorCount: args.doorIds?.length ?? 0, manualMemberCount: args.employeeIds?.length ?? 0, departmentSelections: args.departmentSelections } });
  return ruleId;
}

/** Kural + bağlantıları yazar ve cihaz senkronunu kuyruğa alır; yetkiyi çağıran doğrular. */
export async function insertAccessRuleWithGroups(
  ctx: MutationCtx,
  args: CreateAccessRuleWithGroupsArgs,
): Promise<Id<"accessRules">> {
  if (!args.projectId) throw new Error("Önce bir proje seçin");
  const { departmentSelections, employeeIds: manualIds, deviceIds, doorIds, ...ruleData } = args;
  if (args.targetType === "visitor" && departmentSelections?.length) throw new Error("Ziyaretçi kuralına departman atanamaz");
  const inherited = await departmentMemberIds(ctx, args.projectId, departmentSelections ?? []);
  const employeeIds = [...new Set([...(manualIds ?? []), ...inherited])];
  if (departmentSelections?.length && employeeIds.length > 500) throw new Error("Kural kişi sınırı aşıldı (500)");
  await validateAccessRelations(ctx, args.projectId, { ...args, employeeIds });
  assertAccessSchedule(args);
  if (!args.name.trim()) throw new Error("Kural adı zorunludur");
  const now = new Date().toISOString();
  const ruleId = await ctx.db.insert("accessRules", {
    ...ruleData,
    isActive: ruleData.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });
  if (departmentSelections !== undefined) await writeRuleDepartments(ctx, ruleId, args.projectId, departmentSelections);

  if (employeeIds?.length) {
    await Promise.all(
      employeeIds.map((empId) =>
        ctx.db.insert("groupMembers", {
          groupId: ruleId,
          employeeId: empId,
          projectId: args.projectId,
          createdAt: now,
          ...(departmentSelections?.length ? { source: manualIds?.includes(empId) ? "manual" as const : "department" as const } : {}),
        })
      )
    );
  }

  if (deviceIds?.length) {
    await Promise.all(
      deviceIds.map((devId) =>
        ctx.db.insert("groupDevices", {
          groupId: ruleId,
          deviceId: devId,
          projectId: args.projectId,
          createdAt: now,
        })
      )
    );
  }

  // Kural bazlı kapı seçimi (IDE permission.io kaynağı). doorId → o kapının paneli.
  if (doorIds?.length) {
    await Promise.all(
      doorIds.map(async (doorId) => {
        const door = await ctx.db.get(doorId);
        await ctx.db.insert("groupDoors", {
          groupId: ruleId,
          doorId,
          deviceId: door?.deviceId,
          projectId: args.projectId,
          createdAt: now,
        });
      })
    );
  }

  const syncJobs: Promise<unknown>[] = [
    ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
      accessRuleId: ruleId,
    }),
    ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
      accessRuleId: ruleId,
    }),
  ];
  for (const empId of employeeIds ?? []) {
    syncJobs.push(
      ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
        employeeId: empId,
      }),
      ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
        employeeId: empId,
      }),
    );
  }
  await Promise.all(syncJobs);

  return ruleId;
}
