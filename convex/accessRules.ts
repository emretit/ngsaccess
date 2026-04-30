import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let rules;
    if (args.projectId && allowedProjectIds.some((id) => id === args.projectId)) {
      rules = await ctx.db
        .query("accessRules")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else if (ctx.user.role === "super_admin") {
      rules = await ctx.db.query("accessRules").collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("accessRules")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      rules = results.flat();
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
                    deviceSerial: device.deviceSerial,
                    zoneId: device.zoneId,
                    doorId: device.doorId,
                  }
                : null,
            };
          })
        );

        return {
          ...rule,
          groupMembers: membersWithEmployees,
          groupDevices: devicesWithDetails,
        };
      })
    );
  },
});

export const create = authedMutation({
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
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("accessRules", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
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
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Kural bulunamadı");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu kurala erişim yetkiniz yok");
    }
    const { ruleId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(ruleId, clean);
    return ruleId;
  },
});

export const remove = authedMutation({
  args: { ruleId: v.id("accessRules") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Kural bulunamadı");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu kurala erişim yetkiniz yok");
    }
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

export const createWithGroups = authedMutation({
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
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
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

export const updateWithGroups = authedMutation({
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
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Kural bulunamadı");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu kurala erişim yetkiniz yok");
    }
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
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
export const addGroupMember = authedMutation({
  args: {
    groupId: v.id("accessRules"),
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.groupId);
    if (!rule) throw new Error("Kural bulunamadı");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu gruba erişim yetkiniz yok");
    }
    return await ctx.db.insert("groupMembers", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeGroupMember = authedMutation({
  args: { memberId: v.id("groupMembers") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Üye bulunamadı");
    if (member.projectId && !allowedProjectIds.some((id) => id === member.projectId)) {
      throw new Error("Bu üyeye erişim yetkiniz yok");
    }
    await ctx.db.delete(args.memberId);
  },
});

// Group Devices
export const addGroupDevice = authedMutation({
  args: {
    groupId: v.id("accessRules"),
    deviceId: v.id("devices"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.groupId);
    if (!rule) throw new Error("Kural bulunamadı");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu gruba erişim yetkiniz yok");
    }
    return await ctx.db.insert("groupDevices", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeGroupDevice = authedMutation({
  args: { groupDeviceId: v.id("groupDevices") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const gd = await ctx.db.get(args.groupDeviceId);
    if (!gd) throw new Error("Kayıt bulunamadı");
    if (gd.projectId && !allowedProjectIds.some((id) => id === gd.projectId)) {
      throw new Error("Bu kayda erişim yetkiniz yok");
    }
    await ctx.db.delete(args.groupDeviceId);
  },
});
