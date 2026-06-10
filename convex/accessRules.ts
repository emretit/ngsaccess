
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import {
  resolveRuleIdeDeviceIds,
  reconcileRemovedEmployeeIde,
  reconcilePanelRosterIde,
} from "./lib/accessGraph";
import { diffIds, staleGroupDoorIds } from "./lib/reconcileMath";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Kuraldan cihaz(lar) çıkarılırken o cihazlara ait (CANLI doors.deviceId) groupDoors
 * satırlarını siler. Reconcile kapı bağını artık "yetki" saydığından stale satır,
 * sökülen erişimi panelde yaşatırdı — temizlik bu yüzden zorunlu.
 */
async function deleteStaleGroupDoors(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  removedDeviceIds: ReadonlySet<Id<"devices">>,
): Promise<void> {
  const doorRows = await ctx.db
    .query("groupDoors")
    .withIndex("by_group", (q) => q.eq("groupId", ruleId))
    .collect();
  if (doorRows.length === 0) return;
  const doorDocs = await Promise.all(doorRows.map((row) => ctx.db.get(row.doorId)));
  const doorDeviceById = new Map<Id<"doors">, Id<"devices"> | undefined>();
  for (const door of doorDocs) {
    if (door !== null) doorDeviceById.set(door._id, door.deviceId);
  }
  const staleIds = staleGroupDoorIds(doorRows, doorDeviceById, removedDeviceIds);
  await Promise.all(staleIds.map((id) => ctx.db.delete(id)));
}

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
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
        accessRuleId: ruleId,
      });
      await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
        accessRuleId: ruleId,
      });
    }
    // Kural deaktif edildiğinde IDE panellerindeki kart kayıtlarını sök.
    // syncPermissionToIdePanels permission kaydını günceller ama fiziksel kartı kaldırmaz.
    if (updates.isActive === false) {
      const idePanels = await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);
      await Promise.all(
        idePanels.map((panelId) =>
          reconcilePanelRosterIde(ctx, { deviceId: panelId, projectId: rule.projectId }),
        ),
      );
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
    // Silmeden ÖNCE: kuralın IDE panelleri (cihaz + kapı bağı). Satırlar silinince
    // zincir koptuğu için sonradan çözülemez; aşağıdaki orphan reconcile bunu kullanır.
    const candidatePanels = await resolveRuleIdeDeviceIds(ctx, args.ruleId, rule.projectId);

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

    const doors = await ctx.db
      .query("groupDoors")
      .withIndex("by_group", (q) => q.eq("groupId", args.ruleId))
      .collect();
    await Promise.all(doors.map((d) => ctx.db.delete(d._id)));

    await ctx.db.delete(args.ruleId);

    // Etkilenen üyeleri yeniden sync et — kalan kurallarına göre RightPlan
    // güncellensin, hiç kuralı kalmadıysa cihazdan sökülecek (Phase 5 reconcile).
    // IDE: salt syncEmployeeToIdePanels YETMEZ — kalan IDE bağı olmayan üyede sessiz
    // no-op kalır ve kart panelde yaşardı (silinmiş kuralla geçiş). Silme-öncesi
    // candidatePanels ile gerçek orphan'lardan kart sökülür; helper kalan paneller
    // için syncEmployeeToIdePanels'ı zaten kendisi schedule eder.
    await Promise.all(
      affectedEmployeeIds.flatMap((empId) => [
        ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
          employeeId: empId,
        }),
        reconcileRemovedEmployeeIde(ctx, {
          employeeId: empId,
          projectId: rule.projectId,
          candidatePanels,
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
    doorIds: v.optional(v.array(v.id("doors"))),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const { employeeIds, deviceIds, doorIds, ...ruleData } = args;
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
    doorIds: v.optional(v.array(v.id("doors"))),
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
    const { ruleId, employeeIds, deviceIds, doorIds, projectId: _ignoredProjectId, ...updates } = args;
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
      // Yalnız deviceIds verilen (API) çağrıda çıkarılan cihazların kapı bağlarını da
      // temizle. UI her zaman doorIds da gönderir → aşağıdaki full-replace tek sahip.
      if (doorIds === undefined && removedDeviceIds.length > 0) {
        await deleteStaleGroupDoors(ctx, ruleId, new Set(removedDeviceIds));
      }
    }

    // Kural bazlı kapı seçimi (IDE permission.io kaynağı). Tam değişim: eski sil, yeni yaz.
    // io güncellemesi aşağıdaki syncPermissionToIdePanels ile panele yansır.
    if (doorIds !== undefined) {
      const oldDoors = await ctx.db
        .query("groupDoors")
        .withIndex("by_group", (q) => q.eq("groupId", ruleId))
        .collect();
      await Promise.all(oldDoors.map((d) => ctx.db.delete(d._id)));
      await Promise.all(
        doorIds.map(async (doorId) => {
          const door = await ctx.db.get(doorId);
          await ctx.db.insert("groupDoors", {
            groupId: ruleId,
            doorId,
            deviceId: door?.deviceId,
            projectId: rule.projectId,
            createdAt: now,
          });
        })
      );
    }

    // Düzenleme-SONRASI: kalan ve çıkarılan üyeler.
    const survivingMemberIds =
      employeeIds !== undefined ? employeeIds : oldEmployeeIds;
    const removedEmployeeIds =
      employeeIds !== undefined ? diffIds(oldEmployeeIds, employeeIds).removed : [];

    const syncJobs: Promise<unknown>[] = [
      ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
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
        ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
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
          ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
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

    // Roster eşitleme: üye/cihaz/kapı veya isActive değiştiğinde paneldeki hayalet
    // kartları sök (isActive-only API çağrısında atlanırsa pasif kuralın kartları
    // panelde kalırdı — update() mutation'daki muadiliyle simetrik). Salt isim/saat/gün
    // güncellemelerinde (roster değişmez) atla.
    const rosterChanged =
      employeeIds !== undefined ||
      deviceIds !== undefined ||
      doorIds !== undefined ||
      updates.isActive !== undefined;
    if (rosterChanged) {
      // Panel listesi değişmediyse (deviceIds/doorIds dokunulmadı) ikinci DB gezisi gereksiz —
      // daha önce yakalanan ruleIdePanelsBefore ile aynı sonuç.
      const ideePanelsNow =
        deviceIds === undefined && doorIds === undefined
          ? ruleIdePanelsBefore
          : await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);
      for (const panelId of ideePanelsNow) {
        syncJobs.push(
          reconcilePanelRosterIde(ctx, { deviceId: panelId, projectId: rule.projectId }),
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
    // projectId istemciden değil kuraldan: farklı düşerse üye, reconcile'ın
    // by_project_group sorgusuna görünmez ve kartı hayalet sanılıp süpürülürdü.
    const id = await ctx.db.insert("groupMembers", {
      ...args,
      projectId: rule.projectId,
      createdAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
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
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
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
    // projectId istemciden değil kuraldan (addGroupMember'daki gerekçeyle aynı).
    const id = await ctx.db.insert("groupDevices", {
      ...args,
      projectId: rule.projectId,
      createdAt: new Date().toISOString(),
    });
    // Bu gruba bağlı tüm çalışanları yeni cihaza sync et + week-plan'ı cihaza yaz.
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
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

    // Cihazla birlikte o cihaza ait kapı bağlarını da sil — stale groupDoors satırı
    // reconcile'ın kapı bacağında "yetki" üretip sökülen erişimi yaşatırdı. Aynı cihaza
    // başka bir link kaldıysa DOKUNMA: kapı seçimini silmek getRuleIoIdsForPanel
    // fallback'ini tetikleyip erişimi panelin TÜM kapılarına genişletirdi.
    // Üye reconcile'ından ÖNCE olmalı ki `remaining` stale bağ yüzünden paneli
    // "hâlâ erişiliyor" saymasın.
    const siblingLinks = await ctx.db
      .query("groupDevices")
      .withIndex("by_group", (q) => q.eq("groupId", gd.groupId))
      .collect();
    const stillLinked = siblingLinks.some((l) => l.deviceId === gd.deviceId);
    if (!stillLinked) {
      await deleteStaleGroupDoors(ctx, gd.groupId, new Set([gd.deviceId]));
    }

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
        ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
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
