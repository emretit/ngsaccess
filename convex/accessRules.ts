import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let rules;
    if (args.projectId) {
      rules = await ctx.db
        .query("accessRules")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else if (args.isSuperAdmin) {
      rules = await ctx.db.query("accessRules").collect();
    } else {
      return [];
    }

    return await Promise.all(
      rules.map(async (rule) => {
        const groupMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_group", (q) => q.eq("groupId", rule._id))
          .collect();

        const membersWithEmployees = await Promise.all(
          groupMembers.map(async (gm) => {
            const employee = await ctx.db.get(gm.employeeId);
            return {
              ...gm,
              employees: employee
                ? {
                    id: employee._id,
                    first_name: employee.firstName,
                    last_name: employee.lastName,
                    email: employee.email,
                  }
                : null,
            };
          })
        );

        const groupDevices = await ctx.db
          .query("groupDevices")
          .withIndex("by_group", (q) => q.eq("groupId", rule._id))
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
                    device_serial: device.deviceSerial,
                    zone_id: device.zoneId,
                    door_id: device.doorId,
                  }
                : null,
            };
          })
        );

        return {
          ...rule,
          group_members: membersWithEmployees,
          group_devices: devicesWithDetails,
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isTemplate: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("accessRules", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("accessRules"),
    name: v.optional(v.string()),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isTemplate: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ruleId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(ruleId, clean);
    return ruleId;
  },
});

export const remove = mutation({
  args: { ruleId: v.id("accessRules") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.ruleId))
      .collect();
    await Promise.all(members.map((m) => ctx.db.delete(m._id)));

    const devices = await ctx.db
      .query("groupDevices")
      .withIndex("by_group", (q) => q.eq("groupId", args.ruleId))
      .collect();
    await Promise.all(devices.map((d) => ctx.db.delete(d._id)));

    await ctx.db.delete(args.ruleId);
  },
});

export const createWithGroups = mutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    employeeIds: v.optional(v.array(v.id("employees"))),
    deviceIds: v.optional(v.array(v.id("devices"))),
  },
  handler: async (ctx, args) => {
    const { employeeIds, deviceIds, ...ruleData } = args;
    const now = new Date().toISOString();
    const ruleId = await ctx.db.insert("accessRules", {
      ...ruleData,
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

    return ruleId;
  },
});

export const updateWithGroups = mutation({
  args: {
    ruleId: v.id("accessRules"),
    name: v.optional(v.string()),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    employeeIds: v.optional(v.array(v.id("employees"))),
    deviceIds: v.optional(v.array(v.id("devices"))),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const { ruleId, employeeIds, deviceIds, projectId, ...updates } = args;
    const now = new Date().toISOString();
    const clean: Record<string, unknown> = { updatedAt: now };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(ruleId, clean);

    if (employeeIds !== undefined) {
      const existing = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", ruleId))
        .collect();
      await Promise.all(existing.map((m) => ctx.db.delete(m._id)));
      await Promise.all(
        employeeIds.map((empId) =>
          ctx.db.insert("groupMembers", {
            groupId: ruleId,
            employeeId: empId,
            projectId,
            createdAt: now,
          })
        )
      );
    }

    if (deviceIds !== undefined) {
      const existing = await ctx.db
        .query("groupDevices")
        .withIndex("by_group", (q) => q.eq("groupId", ruleId))
        .collect();
      await Promise.all(existing.map((d) => ctx.db.delete(d._id)));
      await Promise.all(
        deviceIds.map((devId) =>
          ctx.db.insert("groupDevices", {
            groupId: ruleId,
            deviceId: devId,
            projectId,
            createdAt: now,
          })
        )
      );
    }

    return ruleId;
  },
});

// Group Members
export const addGroupMember = mutation({
  args: {
    groupId: v.id("accessRules"),
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("groupMembers", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeGroupMember = mutation({
  args: { memberId: v.id("groupMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memberId);
  },
});

// Group Devices
export const addGroupDevice = mutation({
  args: {
    groupId: v.id("accessRules"),
    deviceId: v.id("devices"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("groupDevices", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeGroupDevice = mutation({
  args: { groupDeviceId: v.id("groupDevices") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.groupDeviceId);
  },
});
