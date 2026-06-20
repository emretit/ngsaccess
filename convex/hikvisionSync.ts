import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { adminQuery, authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

const HIK_BRIDGE_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;
const HIK_BRIDGE_MAX_POLL = 25;

const hikOperationValidator = v.union(
  v.literal("addPerson"),
  v.literal("updatePerson"),
  v.literal("deletePerson"),
  v.literal("addCard"),
  v.literal("deleteCard"),
  v.literal("addFace"),
  v.literal("deleteFace"),
  v.literal("addFingerprint"),
  v.literal("deleteFingerprint"),
  v.literal("syncWeekPlan"),
  v.literal("syncHoliday"),
  v.literal("syncDoorParam"),
  v.literal("openDoor"),
  v.literal("syncDoorStatusPlan"),
  v.literal("syncVerifyPlan"),
);

/**
 * Çalışanın erişim grupları üzerinden bağlı olduğu cihazları ve kuralları getirir.
 */
export const getEmployeeWithDevices = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return null;

    // Employee'nin dahil olduğu grupları bul
    const groupMemberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", args.employeeId),
      )
      .collect();

    const deviceRules: {
      device: {
        _id: Id<"devices">;
        name: string;
        brand?: "hikvision" | "other" | "ide_smart";
        projectId?: Id<"projects">;
        hikDevIndex?: string;
        ehomeID?: string;
        deviceIp?: string;
        deviceSerial?: string;
        hikTransport?: "gateway" | "localBridge";
        hikDoorCount?: number;
      };
      rule: {
        _id: Id<"accessRules">;
        name?: string;
        hikWeekPlanNo?: number;
        idePermissionNo?: number;
        startTime?: string;
        endTime?: string;
        days?: string[];
      };
    }[] = [];

    for (const gm of groupMemberships) {
      const rule = await ctx.db.get(gm.groupId);
      if (!rule || !rule.isActive) continue;

      const groupDevices = await ctx.db
        .query("groupDevices")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", employee.projectId).eq("groupId", gm.groupId),
        )
        .collect();

      for (const gd of groupDevices) {
        const device = await ctx.db.get(gd.deviceId);
        if (!device || !device.isActive) continue;

        deviceRules.push({
          device: {
            _id: device._id,
            name: device.name,
            brand: device.brand,
            projectId: device.projectId,
            hikDevIndex: device.hikDevIndex,
            ehomeID: device.ehomeID,
            deviceIp: device.deviceIp,
            deviceSerial: device.deviceSerial,
            hikTransport: device.hikTransport,
            hikDoorCount: device.hikDoorCount,
          },
          rule: {
            _id: rule._id,
            name: rule.name,
            hikWeekPlanNo: rule.hikWeekPlanNo,
            idePermissionNo: rule.idePermissionNo,
            startTime: rule.startTime,
            endTime: rule.endTime,
            days: rule.days,
          },
        });
      }
    }

    return {
      employee: {
        _id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        cardNumber: employee.cardNumber,
        projectId: employee.projectId,
        isActive: employee.isActive,
      },
      deviceRules,
    };
  },
});

/**
 * Erişim kuralının bağlı olduğu cihazları ve çalışanları getirir.
 */
export const getAccessRuleWithDevices = internalQuery({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.accessRuleId);
    if (!rule) return null;

    // Gruptaki cihazlar
    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", rule.projectId).eq("groupId", args.accessRuleId),
      )
      .collect();

    const devices: {
      _id: Id<"devices">;
      name: string;
      brand?: "hikvision" | "other" | "ide_smart";
      projectId?: Id<"projects">;
      hikDevIndex?: string;
      deviceIp?: string;
      deviceSerial?: string;
      hikTransport?: "gateway" | "localBridge";
      hikDoorCount?: number;
    }[] = [];

    for (const gd of groupDevices) {
      const device = await ctx.db.get(gd.deviceId);
      if (!device || !device.isActive) continue;
      devices.push({
        _id: device._id,
        name: device.name,
        brand: device.brand,
        projectId: device.projectId,
        hikDevIndex: device.hikDevIndex,
        deviceIp: device.deviceIp,
        deviceSerial: device.deviceSerial,
        hikTransport: device.hikTransport,
        hikDoorCount: device.hikDoorCount,
      });
    }

    // Gruptaki çalışanlar
    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", rule.projectId).eq("groupId", args.accessRuleId),
      )
      .collect();

    const employees: {
      _id: string;
      firstName: string;
      lastName: string;
      cardNumber: string;
    }[] = [];

    for (const gm of groupMembers) {
      const emp = await ctx.db.get(gm.employeeId);
      if (!emp || !emp.isActive) continue;
      employees.push({
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        cardNumber: emp.cardNumber,
      });
    }

    return {
      rule: {
        _id: rule._id,
        name: rule.name,
        startTime: rule.startTime,
        endTime: rule.endTime,
        days: rule.days,
        hikWeekPlanNo: rule.hikWeekPlanNo,
        idePermissionNo: rule.idePermissionNo,
        projectId: rule.projectId,
      },
      devices,
      employees,
    };
  },
});

/**
 * Erişim kuralına hikWeekPlanNo atar.
 */
export const assignWeekPlanNo = internalMutation({
  args: {
    accessRuleId: v.id("accessRules"),
    weekPlanNo: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accessRuleId, { hikWeekPlanNo: args.weekPlanNo });
  },
});

/**
 * Debug: tüm zinciri (employees → groupMembers → accessRules → groupDevices → devices)
 * tek bir çağrıda rapor eder. CLI'dan ve admin UI'dan çağrılabilir.
 * adminQuery → sadece super_admin / project_admin erişebilir.
 */
export const debugSyncChain = adminQuery({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();
    const employees = await ctx.db.query("employees").collect();
    const rules = await ctx.db.query("accessRules").collect();
    const members = await ctx.db.query("groupMembers").collect();
    const groupDevs = await ctx.db.query("groupDevices").collect();

    return {
      devices: devices.map((d) => ({
        _id: d._id,
        name: d.name,
        deviceIp: d.deviceIp,
        ehomeID: d.ehomeID ?? null,
        hikDevIndex: d.hikDevIndex ?? null,
        hikModel: d.hikModel ?? null,
        hikLastSeenAt: d.hikLastSeenAt ?? null,
        hikOfflineHint: d.hikOfflineHint ?? null,
        isActive: d.isActive ?? null,
      })),
      employees: employees.map((e) => ({
        _id: e._id,
        name: `${e.firstName} ${e.lastName}`,
        cardNumber: e.cardNumber,
        isActive: e.isActive ?? null,
      })),
      accessRules: rules.map((r) => ({
        _id: r._id,
        name: r.name,
        isActive: r.isActive ?? null,
        days: r.days ?? [],
        startTime: r.startTime ?? null,
        endTime: r.endTime ?? null,
        hikWeekPlanNo: r.hikWeekPlanNo ?? null,
      })),
      groupMembers: members.map((m) => ({
        groupId: m.groupId,
        employeeId: m.employeeId,
      })),
      groupDevices: groupDevs.map((g) => ({
        groupId: g.groupId,
        deviceId: g.deviceId,
      })),
    };
  },
});

/**
 * Yeni cihaz register edildiğinde tüm grup üyelerini ve plan'ları topla.
 * Backfill action bu listeyi kullanarak sync action'larını paralel çalıştırır.
 */
export const getDeviceBackfillTargets = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.brand !== "hikvision") return null;

    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", args.deviceId),
      )
      .collect();

    const accessRuleIds: Id<"accessRules">[] = [];
    const employeeIds: Id<"employees">[] = [];
    for (const gd of groupDevices) {
      accessRuleIds.push(gd.groupId);
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", device.projectId).eq("groupId", gd.groupId),
        )
        .collect();
      for (const m of members) employeeIds.push(m.employeeId);
    }
    return { accessRuleIds, employeeIds };
  },
});

/**
 * Bir projedeki tüm aktif access rule ID'lerini döndürür.
 * Backfill action'ı buradan kuralları çekip her biri için syncWeekPlanToDevices çağırır.
 * super_admin (projectIds boş) → tüm projelerdeki aktif kurallar.
 */
export const listActiveRuleIdsForBackfill = internalQuery({
  args: { projectIds: v.array(v.id("projects")) },
  handler: async (ctx, args): Promise<Id<"accessRules">[]> => {
    // projectIds boş = super_admin (tüm projeler) → full collect zorunlu.
    // Aksi halde by_project index ile her tenant ayrı taranır.
    const rules = args.projectIds.length === 0
      ? await ctx.db.query("accessRules").collect()
      : (
          await Promise.all(
            args.projectIds.map((pid) =>
              ctx.db
                .query("accessRules")
                .withIndex("by_project", (q) => q.eq("projectId", pid))
                .collect(),
            ),
          )
        ).flat();
    return rules.filter((r) => r.isActive !== false).map((r) => r._id);
  },
});

/**
 * Mevcut en yüksek hikWeekPlanNo değerini bulur.
 */
export const getMaxWeekPlanNo = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("accessRules").collect();
    let max = 1;
    for (const r of rules) {
      if (r.hikWeekPlanNo && r.hikWeekPlanNo > max) {
        max = r.hikWeekPlanNo;
      }
    }
    return max;
  },
});

/**
 * Bir cihaza yönelik sync hatasını kalıcı olarak kaydeder.
 * UI banner'ı burayı sorgular — Phase 3 worker tamamlanana kadar tek görünür hata kanalı.
 */
export const recordSyncFailure = internalMutation({
  args: {
    deviceId: v.id("devices"),
    projectId: v.optional(v.id("projects")),
    operation: v.union(
      v.literal("addPerson"),
      v.literal("updatePerson"),
      v.literal("deletePerson"),
      v.literal("addCard"),
      v.literal("deleteCard"),
      v.literal("addFace"),
      v.literal("deleteFace"),
      v.literal("addFingerprint"),
      v.literal("deleteFingerprint"),
      v.literal("syncWeekPlan"),
      v.literal("syncHoliday"),
      v.literal("syncDoorParam"),
      v.literal("openDoor"),
      v.literal("syncDoorStatusPlan"),
      v.literal("syncVerifyPlan"),
    ),
    lastError: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("hikPendingOperations", {
      deviceId: args.deviceId,
      projectId: args.projectId,
      operation: args.operation,
      payload: args.payload ?? {},
      status: "failed",
      attemptCount: 1,
      lastError: args.lastError,
      createdAt: Date.now(),
    });
  },
});

export const enqueueLocalBridgeOperation = internalMutation({
  args: {
    deviceId: v.id("devices"),
    projectId: v.optional(v.id("projects")),
    operation: hikOperationValidator,
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.brand !== "hikvision") {
      throw new Error("Local bridge op sadece Hikvision cihazlar için yazılabilir");
    }
    if (device.hikTransport !== "localBridge") {
      throw new Error("Cihaz localBridge transport kullanmıyor");
    }
    return await ctx.db.insert("hikPendingOperations", {
      deviceId: args.deviceId,
      projectId: args.projectId,
      operation: args.operation,
      payload: args.payload,
      status: "pending",
      attemptCount: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

function isLocalBridgeDevice(device: Doc<"devices"> | null): device is Doc<"devices"> {
  return device !== null && device.brand === "hikvision" && device.hikTransport === "localBridge";
}

export const claimLocalBridgeOperations = internalMutation({
  args: {
    token: v.string(),
    max: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_api_token", (q) => q.eq("apiToken", args.token))
      .first();
    if (!isLocalBridgeDevice(device)) {
      return { ok: false, error: "unauthorized", operations: [] };
    }

    const now = Date.now();
    const staleCutoff = now - HIK_BRIDGE_PROCESSING_TIMEOUT_MS;
    const processing = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_device_status", (q) =>
        q.eq("deviceId", device._id).eq("status", "processing"),
      )
      .take(100);
    await Promise.all(
      processing
        .filter((op) => (op.processingStartedAt ?? op.createdAt) < staleCutoff)
        .map((op) =>
          ctx.db.patch(op._id, {
            status: "pending",
            nextRetryAt: now,
            lastError: "Bridge claim timeout; pending'e alındı",
          }),
        ),
    );

    const requestedMax = Math.floor(args.max ?? 10);
    const max = Math.min(Math.max(requestedMax, 1), HIK_BRIDGE_MAX_POLL);
    const pending = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_device_status", (q) =>
        q.eq("deviceId", device._id).eq("status", "pending"),
      )
      .take(max * 2);
    const due = pending
      .filter((op) => (op.nextRetryAt ?? 0) <= now)
      .slice(0, max);

    await Promise.all(
      due.map((op) =>
        ctx.db.patch(op._id, {
          status: "processing",
          attemptCount: op.attemptCount + 1,
          processingStartedAt: now,
          lastError: undefined,
        }),
      ),
    );

    return {
      ok: true,
      device: {
        deviceId: device._id,
        name: device.name,
        deviceIp: device.deviceIp,
        deviceSerial: device.deviceSerial,
        hikDoorCount: device.hikDoorCount,
      },
      operations: due.map((op) => ({
        opId: op._id,
        operation: op.operation,
        payload: op.payload,
        attemptCount: op.attemptCount + 1,
        createdAt: op.createdAt,
      })),
    };
  },
});

export const ackLocalBridgeOperation = internalMutation({
  args: {
    token: v.string(),
    opId: v.id("hikPendingOperations"),
    ok: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_api_token", (q) => q.eq("apiToken", args.token))
      .first();
    if (!isLocalBridgeDevice(device)) {
      return { ok: false, error: "unauthorized" };
    }
    const op = await ctx.db.get(args.opId);
    if (!op || op.deviceId !== device._id) {
      return { ok: false, error: "operation not found" };
    }
    if (args.ok) {
      await ctx.db.patch(args.opId, {
        status: "done",
        completedAt: Date.now(),
        lastError: undefined,
      });
      return { ok: true };
    }
    await ctx.db.patch(args.opId, {
      status: "failed",
      lastError: args.message ?? "Bridge operation failed",
    });
    return { ok: true };
  },
});

export const requeueStaleLocalBridgeOperations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const staleCutoff = now - HIK_BRIDGE_PROCESSING_TIMEOUT_MS;
    const processing = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_created", (q) => q.eq("status", "processing"))
      .take(200);
    const deviceIds = Array.from(new Set(processing.map((op) => op.deviceId)));
    const devices = await Promise.all(deviceIds.map((id) => ctx.db.get(id)));
    const localBridgeDeviceIds = new Set(
      devices
        .filter(isLocalBridgeDevice)
        .map((device) => device._id),
    );
    const stale = processing.filter(
      (op) =>
        localBridgeDeviceIds.has(op.deviceId) &&
        (op.processingStartedAt ?? op.createdAt) < staleCutoff,
    );
    await Promise.all(
      stale.map((op) =>
        ctx.db.patch(op._id, {
          status: "pending",
          nextRetryAt: now,
          lastError: "Bridge processing timeout; pending'e alındı",
        }),
      ),
    );
    return { requeued: stale.length };
  },
});

/**
 * Failed records'tan caller'ın görebileceklerini filtreler.
 * super_admin tümünü görür; diğerleri sadece kendi projelerinin kayıtlarını.
 * projectId=undefined (orphan) kayıtlar sadece super_admin'e görünür ve sadece o dismiss edebilir.
 */
function filterVisibleFailures<T extends { projectId?: Id<"projects"> }>(
  ctx: { user: { role?: string } },
  rows: T[],
  allowedProjectIds: Id<"projects">[],
): T[] {
  if (ctx.user.role === "super_admin") return rows;
  return rows.filter((f) =>
    f.projectId !== undefined && isProjectAllowed(allowedProjectIds, f.projectId),
  );
}

/**
 * UI banner için: çözümlenmemiş (status=failed) sync hatalarını döner.
 * payload field'ı UI'ya **döndürülmez** (PII leak vektörünü kapatmak için).
 * Detay gerekiyorsa adminQuery yazılmalı.
 */
export const listSyncIssues = authedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const max = args.limit ?? 50;

    // 4x overfetch — RBAC + device-exists + brand=hikvision filtreleri sonrası slice.
    const failed = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(max * 4);

    const rbacFiltered = filterVisibleFailures(ctx, failed, allowedProjectIds);

    // Cihaz dedupe + lookup
    const deviceIds = Array.from(new Set(rbacFiltered.map((f) => f.deviceId)));
    const devices = await Promise.all(deviceIds.map((id) => ctx.db.get(id)));
    const deviceMap = new Map(
      devices.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d._id, d]),
    );

    // Önce filtre, SONRA slice — non-Hik/silinmiş cihaz hataları slice quota'sını yemesin.
    const hikOnly = rbacFiltered.filter((f) => {
      const device = deviceMap.get(f.deviceId);
      return device !== undefined && device.brand === "hikvision";
    });

    return hikOnly.slice(0, max).map((f) => {
      const device = deviceMap.get(f.deviceId);
      return {
        _id: f._id,
        deviceId: f.deviceId,
        deviceName: device?.name ?? "(bilinmeyen cihaz)",
        deviceBrand: device?.brand ?? null,
        operation: f.operation,
        lastError: f.lastError,
        attemptCount: f.attemptCount,
        createdAt: f.createdAt,
      };
    });
  },
});

/**
 * Kullanıcı hatayı görmüş olarak işaretler (status=done).
 * Orphan (projectId=undefined) kayıtları sadece super_admin dismiss edebilir.
 */
export const dismissSyncIssue = authedMutation({
  args: { issueId: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return;
    if (ctx.user.role !== "super_admin") {
      if (!issue.projectId || !isProjectAllowed(allowedProjectIds, issue.projectId)) {
        throw new Error("Bu kayda erişim yetkiniz yok");
      }
    }
    await ctx.db.patch(args.issueId, {
      status: "done",
      completedAt: Date.now(),
    });
  },
});

/**
 * Worker için retry kandidatlarını döner — status=failed, attemptCount<max,
 * device.hikLastSeenAt son N ms içinde güncellenmiş, ihtiyaç duyulan ilişkili
 * kayıtlar (employee/accessRule/fingerprint) ile birlikte denormalize.
 */
export const listRetryCandidates = internalQuery({
  args: {
    limit: v.number(),
    maxAttempts: v.number(),
    onlineWindowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const failed = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(args.limit * 3);

    const now = Date.now();
    const onlineCutoff = now - args.onlineWindowMs;

    const enriched = await Promise.all(
      failed
        .filter((f) => f.attemptCount < args.maxAttempts)
        .slice(0, args.limit * 2)
        .map(async (f) => {
          const device = await ctx.db.get(f.deviceId);
          if (!device || device.brand !== "hikvision" || !device.hikDevIndex) {
            return null;
          }
          // Online değil → bu tick'te atla, bir sonraki tick'te kontrol edilecek.
          if (!device.hikLastSeenAt || device.hikLastSeenAt < onlineCutoff) {
            return null;
          }

          const payload = (f.payload ?? {}) as Record<string, unknown>;
          const employeeId = payload.employeeId as Id<"employees"> | undefined;
          const employee = employeeId ? await ctx.db.get(employeeId) : null;

          let accessRule: { hikWeekPlanNo?: number; startTime?: string; endTime?: string; days?: string[] } | null = null;
          const accessRuleId = payload.accessRuleId as Id<"accessRules"> | undefined;
          if (accessRuleId) {
            const r = await ctx.db.get(accessRuleId);
            if (r) {
              accessRule = {
                hikWeekPlanNo: r.hikWeekPlanNo,
                startTime: r.startTime,
                endTime: r.endTime,
                days: r.days,
              };
            }
          }

          let fingerprint: { fingerData: string; fingerType?: string } | null = null;
          const fingerPrintID = payload.fingerPrintID as number | undefined;
          if (employeeId && fingerPrintID !== undefined) {
            const fp = await ctx.db
              .query("employeeFingerprints")
              .withIndex("by_employee_fingerprint", (q) =>
                q.eq("employeeId", employeeId).eq("fingerPrintID", fingerPrintID),
              )
              .first();
            if (fp) {
              fingerprint = { fingerData: fp.fingerData, fingerType: fp.fingerType };
            }
          }

          return {
            _id: f._id,
            operation: f.operation,
            payload: f.payload,
            attemptCount: f.attemptCount,
            device: {
              _id: device._id,
              hikDevIndex: device.hikDevIndex,
              name: device.name,
              hikDoorCount: device.hikDoorCount,
            },
            employee: employee
              ? {
                  cardNumber: employee.cardNumber,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                }
              : null,
            accessRule,
            fingerprint,
          };
        }),
    );

    return enriched
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, args.limit);
  },
});

/**
 * Worker bir op'u başarıyla retry ettiyse.
 */
export const markOpDone = internalMutation({
  args: { id: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "done",
      completedAt: Date.now(),
    });
  },
});

/**
 * Bir target için yapılan başarılı sync sonrası eski failure'ları auto-resolve eder.
 * Sync action'ların sonunda çağrılır — `(deviceId, operation)` eşleşen pending failure'ları done yap.
 */
export const resolveTargetFailures = internalMutation({
  args: {
    deviceId: v.id("devices"),
    operations: v.array(
      v.union(
        v.literal("addPerson"),
        v.literal("updatePerson"),
        v.literal("deletePerson"),
        v.literal("addCard"),
        v.literal("deleteCard"),
        v.literal("addFace"),
        v.literal("deleteFace"),
        v.literal("addFingerprint"),
        v.literal("deleteFingerprint"),
        v.literal("syncWeekPlan"),
        v.literal("syncHoliday"),
        v.literal("syncDoorParam"),
        v.literal("openDoor"),
        v.literal("syncDoorStatusPlan"),
        v.literal("syncVerifyPlan"),
      ),
    ),
    employeeId: v.optional(v.id("employees")),
    accessRuleId: v.optional(v.id("accessRules")),
  },
  handler: async (ctx, args) => {
    const opSet = new Set<string>(args.operations);
    const matches = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_device_status", (q) =>
        q.eq("deviceId", args.deviceId).eq("status", "failed"),
      )
      .collect();

    const now = Date.now();
    const writes: Promise<unknown>[] = [];
    for (const f of matches) {
      if (!opSet.has(f.operation)) continue;
      const payload = (f.payload ?? {}) as Record<string, unknown>;
      // employeeId/accessRuleId verilmişse sadece eşleşenleri temizle.
      if (args.employeeId && payload.employeeId !== args.employeeId) continue;
      if (args.accessRuleId && payload.accessRuleId !== args.accessRuleId) continue;
      writes.push(
        ctx.db.patch(f._id, { status: "done", completedAt: now }),
      );
    }
    await Promise.all(writes);
    return writes.length;
  },
});

/**
 * Worker retry başarısız oldu → attemptCount++ + lastError güncelle.
 */
export const markOpRetried = internalMutation({
  args: {
    id: v.id("hikPendingOperations"),
    lastError: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return;
    await ctx.db.patch(args.id, {
      attemptCount: row.attemptCount + 1,
      lastError: args.lastError,
    });
  },
});

/**
 * Periyodik temizlik — Worker retry edemeyecek kalıcı failure'ları auto-dismiss.
 * Cron tarafından çağrılır.
 *
 * Temizlenen durumlar:
 * - Non-Hikvision cihaz (worker filter zaten skip ediyor, kalıcı orphan)
 * - Silinmiş cihaz (foreign key boş)
 * - 24h+ eski + attemptCount>=max (terminal failure)
 */
const CLEANUP_BATCH_SIZE = 500;

export const cleanupStaleSyncIssues = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffAt = Date.now() - 24 * 60 * 60 * 1000;
    // Bounded scan — birikim olursa sonraki tick devam eder.
    const failed = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .order("asc")
      .take(CLEANUP_BATCH_SIZE);

    // Cihaz lookup'unu dedupe et — aynı cihazda biriken birden fazla failure varsa tek get.
    const deviceIds = Array.from(new Set(failed.map((f) => f.deviceId)));
    const devices = await Promise.all(deviceIds.map((id) => ctx.db.get(id)));
    const deviceMap = new Map(
      devices
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id, d]),
    );

    const now = Date.now();
    const patches: Promise<unknown>[] = [];
    for (const f of failed) {
      const device = deviceMap.get(f.deviceId);
      const isOrphan = !device;
      const isNonHik = device !== undefined && device.brand !== "hikvision";
      const isStaleTerminal = f.createdAt < cutoffAt && f.attemptCount >= 5;
      if (isOrphan || isNonHik || isStaleTerminal) {
        patches.push(ctx.db.patch(f._id, { status: "done", completedAt: now }));
      }
    }
    await Promise.all(patches);
    return { dismissed: patches.length };
  },
});

/**
 * Tüm görünür sync hatalarını topluca temizle (banner'daki "Hepsini kapat" için).
 */
export const dismissAllSyncIssues = authedMutation({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const failed = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .collect();

    const targets = filterVisibleFailures(ctx, failed, allowedProjectIds);
    const completedAt = Date.now();
    await Promise.all(
      targets.map((f) => ctx.db.patch(f._id, { status: "done", completedAt })),
    );
    return targets.length;
  },
});
