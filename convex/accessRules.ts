
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import {
  resolveRuleIdeDeviceIds,
  reconcileRemovedEmployeeIde,
} from "./lib/accessGraph";
import { diffIds } from "./lib/reconcileMath";
import type { Id } from "./_generated/dataModel";

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

    // Plan-ilişkili alanlardan biri değiştiyse week plan'ı cihazlara yeniden yaz.
    const planAffected =
      updates.startTime !== undefined ||
      updates.endTime !== undefined ||
      updates.days !== undefined ||
      updates.isActive !== undefined;
    if (planAffected) {
      await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncWeekPlanToDevices, {
        accessRuleId: ruleId,
      });
      await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
        accessRuleId: ruleId,
      });
    }
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
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", rule.projectId).eq("groupId", args.ruleId),
      )
      .collect();
    const affectedEmployeeIds = members.map((m) => m.employeeId);
    await Promise.all(members.map((m) => ctx.db.delete(m._id)));

    const devices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", rule.projectId).eq("groupId", args.ruleId),
      )
      .collect();
    await Promise.all(devices.map((d) => ctx.db.delete(d._id)));

    await ctx.db.delete(args.ruleId);

    // Etkilenen üyeleri yeniden sync et — kalan kurallarına göre RightPlan
    // güncellensin, hiç kuralı kalmadıysa cihazdan sökülecek (Phase 5 reconcile).
    await Promise.all(
      affectedEmployeeIds.flatMap((empId) => [
        ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
          employeeId: empId,
        }),
        ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
          employeeId: empId,
        }),
      ]),
    );
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

    const syncJobs: Promise<unknown>[] = [
      ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncWeekPlanToDevices, {
        accessRuleId: ruleId,
      }),
      ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
        accessRuleId: ruleId,
      }),
    ];
    for (const empId of employeeIds ?? []) {
      syncJobs.push(
        ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
          employeeId: empId,
        }),
        ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
          employeeId: empId,
        }),
      );
    }
    await Promise.all(syncJobs);

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
    const { ruleId, employeeIds, deviceIds, projectId: _ignoredProjectId, ...updates } = args;
    const now = new Date().toISOString();
    const clean: Record<string, unknown> = { updatedAt: now };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(ruleId, clean);

    // Düzenleme-ÖNCESİ durumu yakala: çıkarılan üye/cihazların erişim kaybettiği panelleri
    // reconcile için SİLMEDEN önce çöz (resolver'lar groupMembers/groupDevices üstünden yürür;
    // satırlar silinince zincir kopar).
    const oldMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", rule.projectId).eq("groupId", ruleId),
      )
      .collect();
    const oldEmployeeIds = oldMembers.map((m) => m.employeeId);
    const ruleIdePanelsBefore = await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);

    if (employeeIds !== undefined) {
      await Promise.all(oldMembers.map((m) => ctx.db.delete(m._id)));
      await Promise.all(
        employeeIds.map((empId) =>
          ctx.db.insert("groupMembers", {
            groupId: ruleId,
            employeeId: empId,
            projectId: rule.projectId,
            createdAt: now,
          })
        )
      );
    }

    const removedIdePanels: Id<"devices">[] = [];
    if (deviceIds !== undefined) {
      const oldDevices = await ctx.db
        .query("groupDevices")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", ruleId),
        )
        .collect();
      await Promise.all(oldDevices.map((d) => ctx.db.delete(d._id)));
      await Promise.all(
        deviceIds.map((devId) =>
          ctx.db.insert("groupDevices", {
            groupId: ruleId,
            deviceId: devId,
            projectId: rule.projectId,
            createdAt: now,
          })
        )
      );
      const removedDeviceIds = diffIds(
        oldDevices.map((d) => d.deviceId),
        deviceIds,
      ).removed;
      for (const devId of removedDeviceIds) {
        const device = await ctx.db.get(devId);
        if (device && device.isActive && device.brand === "ide_smart") {
          removedIdePanels.push(devId);
        }
      }
    }

    // Düzenleme-SONRASI: kalan ve çıkarılan üyeler.
    const survivingMemberIds =
      employeeIds !== undefined ? employeeIds : oldEmployeeIds;
    const removedEmployeeIds =
      employeeIds !== undefined ? diffIds(oldEmployeeIds, employeeIds).removed : [];

    const syncJobs: Promise<unknown>[] = [
      ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncWeekPlanToDevices, {
        accessRuleId: ruleId,
      }),
      ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
        accessRuleId: ruleId,
      }),
    ];

    // Çıkarılan üyeler: kuralın eski panellerinden orphan kart sökülür, başka kuralla erişilen
    // panellerde permissions[] AZALTILIR (kişi silinmez).
    for (const empId of removedEmployeeIds) {
      syncJobs.push(
        ctx.scheduler.runAfter(0, api.actions.hikvisionSync.deleteEmployeeFromDevices, {
          employeeId: empId,
        }),
        reconcileRemovedEmployeeIde(ctx, {
          employeeId: empId,
          projectId: rule.projectId,
          candidatePanels: ruleIdePanelsBefore,
        }),
      );
    }

    // Kalan üyeler: güncel kuralla yeniden sync + (varsa) çıkarılan cihazlardan orphan reconcile.
    // Yalnız üye listesi değiştiğinde veya bir IDE paneli çıkarıldığında gerek var (sadece
    // saat/gün değişiminde syncPermissionToIdePanels yeterli).
    if (employeeIds !== undefined || removedIdePanels.length > 0) {
      for (const empId of survivingMemberIds) {
        syncJobs.push(
          ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
            employeeId: empId,
          }),
          reconcileRemovedEmployeeIde(ctx, {
            employeeId: empId,
            projectId: rule.projectId,
            candidatePanels: removedIdePanels,
          }),
        );
      }
    }
    await Promise.all(syncJobs);

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
    const id = await ctx.db.insert("groupMembers", {
      ...args,
      createdAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
      employeeId: args.employeeId,
    });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
      employeeId: args.employeeId,
    });
    return id;
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
    const employeeId = member.employeeId;
    // Silinen kuralın IDE panelleri (commit ÖNCESİ; üyelik silinince zincir kopar).
    const removedRulePanels = await resolveRuleIdeDeviceIds(ctx, member.groupId, member.projectId);

    await ctx.db.delete(args.memberId);
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.deleteEmployeeFromDevices, {
      employeeId,
    });

    // IDE: gerçek orphan panellerden kart sökülür, hâlâ erişilenlerde permissions[] azaltılır.
    await reconcileRemovedEmployeeIde(ctx, {
      employeeId,
      projectId: member.projectId,
      candidatePanels: removedRulePanels,
    });
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
    const id = await ctx.db.insert("groupDevices", {
      ...args,
      createdAt: new Date().toISOString(),
    });
    // Bu gruba bağlı tüm çalışanları yeni cihaza sync et + week-plan'ı cihaza yaz.
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncWeekPlanToDevices, {
      accessRuleId: args.groupId,
    });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
      accessRuleId: args.groupId,
    });
    // IDE: syncPermissionToIdePanels yalnızca permission RECORD'unu yazar; o izne sahip
    // USER'lar da yeni panele yazılmalı yoksa kimse geçemez (Hikvision'da
    // syncWeekPlanToDevices üyeleri zaten bind eder). Gruptaki üyeleri yeni panele sync et.
    const groupMembersForDevice = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", rule.projectId).eq("groupId", args.groupId),
      )
      .collect();
    await Promise.all(
      groupMembersForDevice.map((m) =>
        ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
          employeeId: m.employeeId,
        }),
      ),
    );
    return id;
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
    // Çıkarılan cihaz aktif bir IDE paneli mi? (SİLMEDEN önce yakala.)
    const removedDevice = await ctx.db.get(gd.deviceId);
    const removedIdePanels: Id<"devices">[] =
      removedDevice && removedDevice.isActive && removedDevice.brand === "ide_smart"
        ? [gd.deviceId]
        : [];

    await ctx.db.delete(args.groupDeviceId);

    // Bu gruba bağlı üyeleri yeniden sync — diğer kurallarla cihazda kalabilirler.
    // reconcileRemovedEmployeeIde: çıkarılan panele başka kuralla erişemeyen üyenin kartı
    // sökülür (orphan), erişebilenin permissions[] azaltılır (kişi silinmez).
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", gd.projectId).eq("groupId", gd.groupId),
      )
      .collect();
    await Promise.all(
      members.flatMap((m) => [
        ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
          employeeId: m.employeeId,
        }),
        reconcileRemovedEmployeeIde(ctx, {
          employeeId: m.employeeId,
          projectId: gd.projectId,
          candidatePanels: removedIdePanels,
        }),
      ]),
    );
  },
});
