import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { resolveProjectScope } from "./projectScope";

/** Membership-level read per roles inventory; writes require accessRules.manage in accessRules. */
export async function listAccessRules(
  ctx: QueryCtx & { user: Doc<"users"> },
  args: { projectId?: Id<"projects"> },
) {
  const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
  const rules = (await Promise.all(allowedProjectIds.map(projectId =>
    ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
  ))).flat();

  return await Promise.all(
    rules.map(async (rule) => {
      const groupMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", rule._id),
        )
        .collect();

      const membersWithEmployees = await Promise.all(
        groupMembers.map(async (gm) => {
          const employee = await ctx.db.get(gm.employeeId);
          return {
            ...gm,
            employees: employee
              ? {
                  id: employee._id,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  email: employee.email,
                }
              : null,
          };
        })
      );

      const groupDevices = await ctx.db
        .query("groupDevices")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", rule._id),
        )
        .collect();

      const devicesWithDetails = await Promise.all(
        groupDevices.map(async (gd) => {
          const device = await ctx.db.get(gd.deviceId);
          return {
            ...gd,
            devices: device
              ? {
                  id: device._id,
                  name: device.name,
                  brand: device.brand,
                  ideUuid: device.ideUuid,
                  deviceSerial: device.deviceSerial,
                  zoneId: device.zoneId,
                  doorId: device.doorId,
                }
              : null,
          };
        })
      );

      const groupDoors = await ctx.db
        .query("groupDoors")
        .withIndex("by_group", (q) => q.eq("groupId", rule._id))
        .collect();

      return {
        ...rule,
        groupMembers: membersWithEmployees,
        groupDevices: devicesWithDetails,
        groupDoors: groupDoors.map((gd) => ({
          doorId: gd.doorId,
          deviceId: gd.deviceId,
        })),
      };
    })
  );
}

/** Membership projection for employee screens; no employee/device document joins. */
export async function listAccessRuleMemberships(
  ctx: QueryCtx & { user: Doc<"users"> },
  args: { projectId?: Id<"projects"> },
) {
  const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
  const rules = (await Promise.all(allowedProjectIds.map(projectId =>
    ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
  ))).flat();

  return await Promise.all(rules.map(async (rule) => {
    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_group", q =>
        q.eq("projectId", rule.projectId).eq("groupId", rule._id),
      )
      .collect();
    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_group", q =>
        q.eq("projectId", rule.projectId).eq("groupId", rule._id),
      )
      .collect();
    return {
      _id: rule._id,
      name: rule.name,
      isActive: rule.isActive,
      groupMembers: groupMembers.map(({ employeeId }) => ({ employeeId })),
      groupDevices: groupDevices.map(({ deviceId }) => ({ deviceId })),
    };
  }));
}
