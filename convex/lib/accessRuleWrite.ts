import { requirePermission } from "./permissions";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { validateScheduleBinding, assertIdeScheduleCapacity } from "../accessScheduleTemplates";
import { validateAccessRelations } from "./accessScopeRelations";
import { assertAccessSchedule } from "./accessRuleUx";
import { resolveProjectScope } from "./projectScope";

type CreateAccessRuleWithGroupsArgs = {
  scheduleTemplateId?: Id<"accessScheduleTemplates"> | null;
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
};

/** Called only by accessRules.createWithGroups after authorization. */
export async function createAccessRuleWithGroups(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: CreateAccessRuleWithGroupsArgs,
): Promise<Id<"accessRules">> {
  await resolveProjectScope(ctx, args.projectId);
  if (!args.projectId) throw new Error("Önce bir proje seçin");
  await requirePermission(ctx, ctx.user, args.projectId, "accessRules.manage");
  await validateAccessRelations(ctx, args.projectId, args);
  const { employeeIds, deviceIds, doorIds, ...ruleData } = args;
  await validateScheduleBinding(ctx, args.projectId, args.scheduleTemplateId);
  assertAccessSchedule(args);
  if (!args.name.trim()) throw new Error("Kural adı zorunludur");
  const now = new Date().toISOString();
  const ruleId = await ctx.db.insert("accessRules", {
    ...ruleData,
    scheduleTemplateId: ruleData.scheduleTemplateId ?? undefined,
    isActive: ruleData.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });

  if (employeeIds?.length) {
    await Promise.all(
      employeeIds.map((empId) =>
        ctx.db.insert("groupMembers", {
          groupId: ruleId,
          employeeId: empId,
          projectId: args.projectId,
          createdAt: now,
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

  if (args.scheduleTemplateId) await assertIdeScheduleCapacity(ctx, args.projectId, undefined, [ruleId]);
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
