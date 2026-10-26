import { asKeyPart } from "./lib/hikKeyPart";
import { requirePermission, getProjectIdsWithPermission } from "./lib/permissions";
import { writeAudit } from "./lib/audit";
import { internal } from "./_generated/api";
import { snapshotEmployeeHikDevices, resolveRuleDeviceTargets, hasWritableHikCredential } from "./lib/peopleHikSnapshot";
import { grantStatusForOperation } from "./lib/grantStatus";
import type { ScheduleTemplate } from "./lib/accessSchedule";
import { mobileOperationId, mobileQueueAllowed } from "./lib/mobileAccess";
import { assertBiometricAllowed, biometricPayloadProject, isBiometricAddition } from "./lib/biometricGate";
import { isBiometricEnabled } from "./lib/privacySettings";
import { v } from "convex/values";
import { scheduleBridgeWakeForProject } from "./hikBridge";
import { internalQuery, internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/customFunctions";
import { getCurrentUser, getValidAuthUserId } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";
import { scanHikSync, assertSyncScope } from "./lib/syncStatusScope";
import { canRetrySync, syncDismissPatch } from "./lib/syncStatusLogic";
import { hasFreshIsupStatus } from "./lib/deviceConnection";

const HIK_BRIDGE_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;
const HIK_BRIDGE_MAX_POLL = 25;
const HIK_BRIDGE_DEDUPE_SCAN = 100;

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
type EmployeeDeviceRule = {
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
  /** undefined = explicit device leg; [] = no usable selected door. */
  doorNos?: number[];
  rule: {
    _id: Id<"accessRules">;
    name?: string;
    hikWeekPlanNo?: number;
    idePermissionNo?: number;
    scheduleTemplateId?: Id<"accessScheduleTemplates">;
    scheduleTemplate?: ScheduleTemplate | null;
    projectId?: Id<"projects">;
    ideExtraPermissionNos?: number[];
    startTime?: string;
    endTime?: string;
    days?: string[];
  };
};
type RuleScopeCache = Map<string, Promise<EmployeeDeviceRule[]>>;

export const getEmployeeWithDevices = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: (ctx, args) => employeeWithDevices(ctx, args.employeeId),
});

export const getEmployeesWithDevices = internalQuery({
  args: { employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args) => {
    if (args.employeeIds.length > 20) throw new Error("Çalışan toplu okuma sınırı aşıldı");
    const scopes: RuleScopeCache = new Map();
    return await Promise.all(args.employeeIds.map(id => employeeWithDevices(ctx, id, scopes)));
  },
});

async function employeeWithDevices(ctx: QueryCtx, employeeId: Id<"employees">, scopes: RuleScopeCache = new Map()) {
  const employee = await ctx.db.get(employeeId);
  if (!employee) return null;

  // Employee'nin dahil olduğu grupları bul
  const groupMemberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_project_employee", (q) =>
      q.eq("projectId", employee.projectId).eq("employeeId", employeeId),
    )
    .take(4097);

  if (groupMemberships.length > 4096) throw new Error("Employee rule limit exceeded");

  const deviceRules: EmployeeDeviceRule[] = [];

  for (const gm of groupMemberships) {
    const key = `${employee.projectId}:${gm.groupId}`;
    let scope = scopes.get(key);
    if (!scope) {
      scope = (async () => {
        const resolved: EmployeeDeviceRule[] = [];
        const rule = await ctx.db.get(gm.groupId);
        if (!rule || !rule.isActive || rule.projectId !== employee.projectId) return [];

        for (const { device, doorNos } of await resolveRuleDeviceTargets(ctx, rule)) {
          resolved.push({
            ...(doorNos === undefined || device.brand !== "hikvision" ? {} : { doorNos }),
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
              ideExtraPermissionNos: rule.ideExtraPermissionNos,
              scheduleTemplateId: rule.scheduleTemplateId,
              scheduleTemplate: rule.scheduleTemplateId ? await ctx.db.get(rule.scheduleTemplateId) : null,
              projectId: rule.projectId,
              startTime: rule.startTime,
              endTime: rule.endTime,
              days: rule.days,
            },
          });
        }
        return resolved;
      })();
      scopes.set(key, scope);
    }
    deviceRules.push(...await scope);
  }

  const hasFingerprintTemplates = (await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId)).first()) !== null;
  return {
    previousDevices: (await snapshotEmployeeHikDevices(ctx, employee)).devices,
    hasFingerprintTemplates,
    employee: {
      _id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      cardNumber: employee.cardNumber,
      projectId: employee.projectId,
      isActive: employee.isActive,
      accessStartsAt: employee.accessStartsAt,
    },
    deviceRules,
  };
}

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
      .take(4097);

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

    if (groupDevices.length > 4096) throw new Error("Rule device limit exceeded");
    const deviceIds = new Set(groupDevices.map(gd => gd.deviceId));
    const doorLinks = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(4097);
    if (doorLinks.length > 4096) throw new Error("Rule door limit exceeded");
    for (const link of doorLinks) {
      const door = await ctx.db.get(link.doorId);
      if (!door?.deviceId || door.projectId !== rule.projectId) continue;
      const device = await ctx.db.get(door.deviceId);
      if (device?.brand === "hikvision") deviceIds.add(device._id);
    }
    for (const deviceId of deviceIds) {
      const device = await ctx.db.get(deviceId);
      if (!device || !device.isActive || device.projectId !== rule.projectId) continue;
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
      .take(4097);
    if (groupMembers.length > 4096) throw new Error("Kural çalışan sınırı aşıldı");

    const employees: {
      _id: Id<"employees">;
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
        isActive: rule.isActive,
        startTime: rule.startTime,
        endTime: rule.endTime,
        days: rule.days,
        hikWeekPlanNo: rule.hikWeekPlanNo,
        idePermissionNo: rule.idePermissionNo,
        ideExtraPermissionNos: rule.ideExtraPermissionNos,
        scheduleTemplateId: rule.scheduleTemplateId,
        scheduleTemplate: rule.scheduleTemplateId ? await ctx.db.get(rule.scheduleTemplateId) : null,
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
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.accessRuleId);
    if (!rule) throw new Error("Kural bulunamadı");
    if (rule.hikWeekPlanNo) return rule.hikWeekPlanNo;
    const highest = await ctx.db.query("accessRules").withIndex("by_hikWeekPlanNo").order("desc").first();
    const weekPlanNo = Math.max(1, highest?.hikWeekPlanNo ?? 1) + 1;
    await ctx.db.patch(rule._id, { hikWeekPlanNo: weekPlanNo });
    return weekPlanNo;
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
    const highest = await ctx.db.query("accessRules").withIndex("by_hikWeekPlanNo").order("desc").first();
    return Math.max(1, highest?.hikWeekPlanNo ?? 1);
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

/** Persist identity before network I/O; even a crashed action remains retryable. */
export const beginPersonDeletion = internalMutation({
  args: { deviceId: v.id("devices"), employeeId: v.id("employees"), projectId: v.id("projects"), cardNumber: v.string(), runId: v.optional(v.id("deviceSyncRuns")) },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.projectId !== args.projectId || device.brand !== "hikvision") throw new Error("Silme hedefi proje dışında");
    const id = await ctx.db.insert("hikPendingOperations", {
      deviceId: args.deviceId, projectId: args.projectId, runId: args.runId, operation: "deletePerson",
      payload: { employeeId: args.employeeId, employeeNo: args.cardNumber, cardNumber: args.cardNumber },
      status: "failed", attemptCount: 0, createdAt: Date.now(), lastError: "Silme onayı bekleniyor — cihazda kalmış olabilir",
    });
    await grantStatusForOperation(ctx, { ...args, _id: id, operation: "deletePerson", payload: { employeeId: args.employeeId, cardNumber: args.cardNumber } }, "pending");
    return id;
  },
});

export const enqueueLocalBridgeOperation = internalMutation({
  args: {
    deviceId: v.id("devices"),
    runId: v.optional(v.id("deviceSyncRuns")),
    projectId: v.optional(v.id("projects")),
    operation: hikOperationValidator,
    payload: v.any(),
  },
  handler: enqueueLocalBridgeOperationInTransaction,
});
export async function enqueueLocalBridgeOperationInTransaction(ctx: MutationCtx, args: {
  deviceId: Id<"devices">; runId?: Id<"deviceSyncRuns">; projectId?: Id<"projects">;
  operation: Doc<"hikPendingOperations">["operation"]; payload: unknown;
}) {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.brand !== "hikvision") {
      throw new Error("Local bridge op sadece Hikvision cihazlar için yazılabilir");
    }
    if (device.hikTransport !== "localBridge") {
      throw new Error("Cihaz localBridge transport kullanmıyor");
    }
    if (["deletePerson", "deleteCard"].includes(args.operation)) {
      args = { ...args, projectId: args.projectId ?? device.projectId };
      if (device.projectId !== args.projectId) throw new Error("Silme hedefi proje dışında");
    }
    if (isBiometricAddition(args.operation)) {
      await assertBiometricAllowed(ctx, device.projectId);
      await assertBiometricAllowed(ctx, await biometricPayloadProject(ctx, args.payload));
    }
    const now = Date.now();
    const newKey = localBridgeOperationKey(args.deviceId, args.operation, args.payload);
    for (const status of ["pending", "processing", "failed"] as const) {
      const existingRows = await ctx.db
        .query("hikPendingOperations")
        .withIndex("by_device_status", (q) =>
          q.eq("deviceId", args.deviceId).eq("status", status),
        )
        .take(HIK_BRIDGE_DEDUPE_SCAN);
      const existing = existingRows.find(
        (op) =>
          mobileOperationId(op.payload) === undefined &&
          op.runId === args.runId &&
          (!args.runId || stablePayloadKey(op.payload) === stablePayloadKey(args.payload)) &&
          op.operation === args.operation &&
          localBridgeOperationKey(op.deviceId, op.operation, op.payload) === newKey,
      );
      if (existing) {
        await ctx.db.patch(existing._id, {
          projectId: args.projectId,
          payload: args.payload,
          status: "pending",
          attemptCount: 0,
          nextRetryAt: now,
          processingStartedAt: undefined,
          completedAt: undefined,
          claimedBy: undefined,
          lastError: undefined,
        });
        if (["addPerson", "updatePerson", "deletePerson", "deleteCard"].includes(args.operation)) await grantStatusForOperation(ctx, { ...args, _id: existing._id }, "pending");
        await scheduleBridgeWakeForProject(ctx, device.projectId);
        return existing._id;
      }
    }
    const opId = await ctx.db.insert("hikPendingOperations", {
      deviceId: args.deviceId,
      runId: args.runId,
      projectId: args.projectId,
      operation: args.operation,
      payload: args.payload,
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
    });
    if (["addPerson", "updatePerson", "deletePerson", "deleteCard"].includes(args.operation)) await grantStatusForOperation(ctx, { ...args, _id: opId }, "pending");
    await scheduleBridgeWakeForProject(ctx, device.projectId);
    return opId;
}

function isLocalBridgeDevice(device: Doc<"devices"> | null): device is Doc<"devices"> {
  return device !== null && device.brand === "hikvision" && device.hikTransport === "localBridge";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stablePayloadKey(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "payload";
  }
}

function localBridgeOperationKey(
  deviceId: Id<"devices">,
  operation: Doc<"hikPendingOperations">["operation"],
  payload: unknown,
): string {
  const p = asRecord(payload);
  const primary =
    (operation === "deletePerson" || operation === "deleteCard" ? asKeyPart(p.employeeNo) ?? asKeyPart(p.cardNumber) : null) ??
    asKeyPart(p.accessRuleId) ??
    asKeyPart(p.employeeId) ??
    asKeyPart(p.cardNumber) ??
    asKeyPart(p.employeeNo) ??
    asKeyPart(p.doorNo) ??
    asKeyPart(p.faceStorageId) ??
    asKeyPart(p.fingerPrintID) ??
    stablePayloadKey(payload);
  return `${deviceId}:${operation}:${primary}`;
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
            status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
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
    const biometricEnabled = await isBiometricEnabled(ctx, device.projectId);
    const due: typeof pending = [];
    for (const op of pending) {
      if ((op.nextRetryAt ?? 0) > now) continue;
      if (!(await mobileQueueAllowed(ctx, op))) {
        await ctx.db.patch(op._id, { status: "failed", lastError: "MOBILE_COMMAND_NOT_DELIVERABLE" });
        continue;
      }
      if (isBiometricAddition(op.operation) && (!biometricEnabled ||
          !(await isBiometricEnabled(ctx, await biometricPayloadProject(ctx, op.payload))))) {
        // Move blocked additions out of the pending window so removals can progress.
        await ctx.db.patch(op._id, { status: "failed", attemptCount: 5, lastError: "Biyometri modülü kapalı; işlem gönderilmedi." });
        continue;
      }
      if (isPersonDeletion(op) && deletionUnresolvableReason(op, device)) {
        await ctx.db.patch(op._id, { status: "failed", lastError: deletionUnresolvableReason(op, device) });
        continue;
      }
      const cardNumber = deletionIdentity(op);
      if (isPersonDeletion(op) && cardNumber && await protectCurrentCredential(ctx, op.deviceId, cardNumber)) {
        await supersedeDeletion(ctx, op._id);
        continue;
      }
      due.push(op);
      if (due.length >= max) break;
    }

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

async function resolveAcknowledgedDeletion(ctx: MutationCtx, op: Doc<"hikPendingOperations">): Promise<void> {
  if (op.operation !== "deletePerson" && op.operation !== "deleteCard") return;
  const payload = asRecord(op.payload);
  const cardNumber = payload.employeeNo ?? payload.cardNumber;
  const employeeId = typeof payload.employeeId === "string" ? ctx.db.normalizeId("employees", payload.employeeId) : null;
  if (!employeeId || typeof cardNumber !== "string") return;
  await ctx.runMutation(internal.hikvisionSync.resolveTargetFailures, {
    deviceId: op.deviceId, operations: ["deletePerson", "deleteCard"], employeeId, cardNumber,
  });
}

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
    if (mobileOperationId(op.payload) !== undefined && op.status !== "processing") return { ok: false, error: "operation not processing" };
    // A dedupe may have replaced the in-flight payload; let the bridge fetch it again.
    if (op.status !== "processing") return { ok: true };
    const deletion = op.operation === "deletePerson" || op.operation === "deleteCard";
    const message = deletion && !args.ok ? `Silme başarısız — cihazda kalmış olabilir: ${args.message ?? "Cihaz onayı alınamadı"}` : args.message;
    if (["addPerson", "updatePerson", "deletePerson", "deleteCard"].includes(op.operation)) await grantStatusForOperation(ctx, op,
      args.ok ? (deletion ? "removed" : "effective") : "failed", message);
    if (args.ok) {
      await ctx.db.patch(args.opId, {
        status: "done",
        completedAt: Date.now(),
        lastError: undefined,
      });
      await resolveAcknowledgedDeletion(ctx, op);
      const identity = deletionIdentity(op);
      if (["addPerson", "updatePerson"].includes(op.operation) && identity) await supersedeCurrentCredentialDeletions(ctx, op.deviceId, identity);
      return { ok: true };
    }
    await ctx.db.patch(args.opId, {
      status: "failed",
      lastError: message ?? "Bridge operation failed",
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
          status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
          nextRetryAt: now,
          lastError: "Bridge processing timeout; pending'e alındı",
        }),
      ),
    );
    return { requeued: stale.length };
  },
});

/**
 * UI banner için: çözümlenmemiş (status=failed) sync hatalarını döner.
 * payload field'ı UI'ya **döndürülmez** (PII leak vektörünü kapatmak için).
 * Detay gerekiyorsa authedQuery yazılmalı.
 */
export const listSyncIssues = query({
  args: { projectId: v.optional(v.id("projects")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!(await getValidAuthUserId(ctx))) return { items: [], hasMore: false, unknown: false };
    const user = await getCurrentUser(ctx);
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const scan = await scanHikSync(ctx, projectIds, ["failed"], true);
    const max = Math.min(100, Math.max(1, Math.floor(args.limit ?? 50)));
    const visible = scan.rows.sort((a, b) => b.createdAt - a.createdAt);
    const items = await Promise.all(visible.slice(0, max).map(async (op) => {
      const [device, project] = await Promise.all([
        ctx.db.get(op.deviceId), op.projectId ? ctx.db.get(op.projectId) : null,
      ]);
      return {
        _id: op._id, deviceId: op.deviceId,
        deviceName: device?.name ?? "(silinmiş cihaz)",
        projectId: op.projectId, projectName: project?.name ?? "Bilinmeyen proje",
        status: op.status, lastError: op.lastError ?? null, createdAt: op.createdAt,
        nextRetryAt: op.nextRetryAt,
        operation: op.operation, deviceBrand: device?.brand ?? null, attemptCount: op.attemptCount, attempts: op.attemptCount, maxAttempts: 5, canRetry: isPersonDeletion(op) ? deletionUnresolvableReason(op, device) === undefined : device?.hikTransport === "localBridge",
        canDismiss: !isPersonDeletion(op) || (user.role === "super_admin" && deletionUnresolvableReason(op, device) !== undefined),
      };
    }));
    return { items, hasMore: scan.hasMore || visible.length > max, unknown: scan.unknown };
  },
});

/**
 * Kullanıcı uyarıyı kapatır; operasyon sonucu korunur.
 */
export const dismissSyncIssue = authedMutation({
  args: { issueId: v.id("hikPendingOperations"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx);
    const op = await ctx.db.get(args.issueId);
    if (!op) return;
    const device = await assertSyncScope(ctx, projectIds, op);
    await requirePermission(ctx, ctx.user, op.projectId ?? device?.projectId, "devices.manage");
    const now = Date.now();
    if (isPersonDeletion(op)) {
      if (ctx.user.role !== "super_admin") throw new Error("Silme uyarısını yalnız süper yönetici kapatabilir");
      const reason = args.reason?.trim();
      if (!reason) throw new Error("Kapatma gerekçesi zorunludur");
      if (!deletionUnresolvableReason(op, device)) throw new Error("Cihaz silme onayı olmadan bu hata kapatılamaz");
      if (op.status !== "failed" || op.dismissedAt !== undefined) return;
      await writeAudit(ctx, { user: ctx.user, projectId: op.projectId, action: "update", targetTable: "hikPendingOperations", targetId: op._id,
        oldValue: { status: op.status }, newValue: { status: op.status, dismissedAt: now }, note: `Çözülemez silme uyarısı açıkça kapatıldı: ${reason}` });
    }
    if (op.status !== "failed" || op.dismissedAt !== undefined) return;
    await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
  },
});

/**
 * Worker için retry kandidatlarını döner — status=failed, attemptCount<max,
 * device.hikLastSeenAt son N ms içinde güncellenmiş, ihtiyaç duyulan ilişkili
 * kayıtlar (employee/accessRule/fingerprint) ile birlikte denormalize.
 */
export const listRetryCandidates = internalMutation({
  args: {
    limit: v.number(),
    maxAttempts: v.number(),
    onlineWindowMs: v.number(),
    issueId: v.optional(v.id("hikPendingOperations")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.min(100, Math.max(1, Math.floor(args.limit)));
    // One bounded page per transaction. Ineligible entries are moved out of the
    // due window, so even a backlog larger than this page progresses each tick.
    const selected = args.issueId ? await ctx.db.get(args.issueId) : null;
    const failed = args.issueId ? (selected ? [selected] : []) : (await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_nextRetry", (q) => q.eq("status", "failed").lte("nextRetryAt", now))
      .order("asc")
      .paginate({ numItems: 200, cursor: null })).page;

    const onlineCutoff = now - args.onlineWindowMs;

    const enriched = await Promise.all(
      failed.map(async (f) => {
          if (f.status !== "failed" || (f.nextRetryAt ?? 0) > now) return null;
          if (f.attemptCount >= args.maxAttempts || mobileOperationId(f.payload) !== undefined || f.dismissedAt !== undefined) {
            await ctx.db.patch(f._id, { nextRetryAt: Number.MAX_SAFE_INTEGER });
            return null;
          }
          // Terminal eligibility failures stay visible; enqueue/manual retry reopens them.
          // Dismissed jobs intentionally leave automatic retry, regardless of operation.
          const defer = async (permanent = false) => {
            await ctx.db.patch(f._id, { nextRetryAt: permanent ? Number.MAX_SAFE_INTEGER : now + 3 * 60 * 1000 });
            return null;
          };
          const device = await ctx.db.get(f.deviceId);
          if (!device || device.brand !== "hikvision" || device.hikTransport === "localBridge" || ((f.operation === "deletePerson" || f.operation === "deleteCard") && device.projectId !== f.projectId) || !device.hikDevIndex) {
            return await defer(true);
          }
          if (isBiometricAddition(f.operation) && !(await isBiometricEnabled(ctx, device.projectId))) return await defer(true);
          // Online değil → bu tick'te atla, bir sonraki tick'te kontrol edilecek.
          // Gateway cihazında hikLastSeenAt yalnız bağlanma anında yazılır; taze ISUP durumu esas alınır.
          const online = hasFreshIsupStatus(device, now)
            ? device.hikIsupOnline === true
            : device.hikLastSeenAt !== undefined && device.hikLastSeenAt >= onlineCutoff;
          if (!online) return await defer();

          const payload = (f.payload ?? {}) as Record<string, unknown>;
          const employeeId = payload.employeeId as Id<"employees"> | undefined;
          const employee = employeeId ? await ctx.db.get(employeeId) : null;
          if (isBiometricAddition(f.operation) && !(await isBiometricEnabled(ctx, employee?.projectId))) return await defer(true);

          let accessRule: (Doc<"accessRules"> & { scheduleTemplate: ScheduleTemplate | null }) | null = null;
          const accessRuleId = payload.accessRuleId as Id<"accessRules"> | undefined;
          if (accessRuleId) {
            const r = await ctx.db.get(accessRuleId);
            if (r) {
              accessRule = { ...r, scheduleTemplate: r.scheduleTemplateId ? await ctx.db.get(r.scheduleTemplateId) : null };
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
                  accessStartsAt: employee.accessStartsAt,
                }
              : null,
            accessRule,
          };
        }),
    );

    return enriched
      .filter((e): e is NonNullable<typeof e> => e !== null)
      // Keep due order within each class, with access revocations first.
      .sort((a, b) => Number(["deletePerson", "deleteCard"].includes(b.operation)) - Number(["deletePerson", "deleteCard"].includes(a.operation)))
      .slice(0, limit);
  },
});

/** Kaydın amacı artık geçerli değil; cihaz yazımı ve erişim durumu değişmez. */
export const markOpSuperseded = internalMutation({
  args: { id: v.id("hikPendingOperations"), reason: v.string() },
  handler: async (ctx, args) => {
    const op = await ctx.db.get(args.id);
    if (!op || op.status !== "failed") return;
    await ctx.db.patch(args.id, { status: "done", completedAt: Date.now(), lastError: args.reason });
  },
});

/**
 * Worker bir op'u başarıyla retry ettiyse.
 */
export const markOpDone = internalMutation({
  args: { id: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    const op = await ctx.db.get(args.id);
    if (!op || op.status === "done" || op.dismissedAt !== undefined) return;
    if (op && ["addPerson", "updatePerson", "addCard", "deletePerson"].includes(op.operation)) await grantStatusForOperation(ctx, op, op.operation === "deletePerson" ? "removed" : "effective");
    await ctx.db.patch(args.id, {
      status: "done",
      completedAt: Date.now(),
      lastError: undefined,
    });
    await resolveAcknowledgedDeletion(ctx, op);
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
    employeeIds: v.optional(v.array(v.id("employees"))),
    accessRuleId: v.optional(v.id("accessRules")),
    cardNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const opSet = new Set<string>(args.operations);
    const matches = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_device_status", (q) =>
        q.eq("deviceId", args.deviceId).eq("status", "failed"),
      )
      .take(4097);
    if (matches.length > 4096) throw new Error("Senkron hatası sınırı aşıldı");

    const now = Date.now();
    const writes: Promise<unknown>[] = [];
    for (const f of matches) {
      if (!opSet.has(f.operation)) continue;
      const payload = (f.payload ?? {}) as Record<string, unknown>;
      if (["deletePerson", "deleteCard"].includes(f.operation) && (!args.cardNumber || (payload.employeeNo ?? payload.cardNumber) !== args.cardNumber)) continue;
      // employeeId/accessRuleId verilmişse sadece eşleşenleri temizle.
      if (args.employeeId && payload.employeeId !== args.employeeId) continue;
      if (args.employeeIds && !args.employeeIds.some(id => payload.employeeId === id)) continue;
      if (args.accessRuleId && payload.accessRuleId !== args.accessRuleId) continue;
      // Keep the old run's failure evidence, but an exact credential acknowledgement
      // can hide its now-resolved warning. Enqueue alone never reaches this branch.
      if (f.runId) {
        if (args.cardNumber && ["deletePerson", "deleteCard"].includes(f.operation)) writes.push(ctx.db.patch(f._id, { dismissedAt: now }));
        continue;
      }
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
    if (!row || row.status === "done" || row.dismissedAt !== undefined) return;
    const lastError = row.operation === "deletePerson" || row.operation === "deleteCard"
      ? `Silme başarısız — cihazda kalmış olabilir: ${args.lastError}` : args.lastError;
    if (["addPerson", "updatePerson", "addCard", "deletePerson"].includes(row.operation)) await grantStatusForOperation(ctx, row, "failed", lastError);
    await ctx.db.patch(args.id, {
      status: "failed",
      attemptCount: row.attemptCount + 1,
      lastError,
      dismissedAt: undefined,
      dismissedBy: undefined,
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
    // Convex permits one paginate call per execution. Scan a bounded four-batch window
    // so an initial batch of unresolved deletions cannot hide later terminal failures.
    const result = await ctx.db
      .query("hikPendingOperations")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .order("asc")
      .paginate({ numItems: CLEANUP_BATCH_SIZE * 4, cursor: null });
    const failed = result.page.filter(op => !isPersonDeletion(op));

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
      if (f.operation === "deletePerson" || f.operation === "deleteCard") continue;
      const device = deviceMap.get(f.deviceId);
      const isOrphan = !device;
      const isNonHik = device !== undefined && device.brand !== "hikvision";
      const isStaleTerminal = f.createdAt < cutoffAt && f.attemptCount >= 5;
      if (isOrphan || isNonHik || isStaleTerminal) {
        patches.push(ctx.db.patch(f._id, { status: "done", completedAt: now, dismissedAt: now }));
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
  args: { projectId: v.optional(v.id("projects")), issueIds: v.optional(v.array(v.id("hikPendingOperations"))) },
  handler: async (ctx, args) => {
    if (args.projectId) await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
    const projectIds = args.projectId ? await resolveProjectScope(ctx, args.projectId) : await getProjectIdsWithPermission(ctx, ctx.user, "devices.manage");
    if (args.issueIds && args.issueIds.length > 100) throw new Error("Bir seferde en fazla 100 uyarı kapatılabilir");
    const scan = await scanHikSync(ctx, projectIds, ["failed"], true);
    const requested = args.issueIds
      ? (await Promise.all([...new Set(args.issueIds)].map((id) => ctx.db.get(id))))
        .filter((op): op is NonNullable<typeof op> => op !== null)
      : scan.rows;
    // Önizleme ile aynı kimlikler; yeni gelen uyarılar toplu kapatmaya dahil edilmez.
    for (const op of requested) {
      const device = await assertSyncScope(ctx, projectIds, op);
      await requirePermission(ctx, ctx.user, op.projectId ?? device?.projectId, "devices.manage");
    }
    const targets = requested.filter((op) => op.operation !== "deletePerson" && op.operation !== "deleteCard" && op.status === "failed" && op.dismissedAt === undefined).slice(0, 100);
    const now = Date.now();
    for (const op of targets) {
      await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
    }
    return { count: targets.length, hasMore: scan.hasMore || scan.rows.length > targets.length, unknown: scan.unknown };
  },
});

/** Tek op yeniden sıraya alınır; bridge claim/ack akışı değişmez. */
export const retrySyncIssue = authedMutation({
  args: { issueId: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx);
    const op = await ctx.db.get(args.issueId);
    if (!op) throw new Error("İşlem bulunamadı");
    const device = await assertSyncScope(ctx, projectIds, op);
    await requirePermission(ctx, ctx.user, op.projectId ?? device?.projectId, "devices.manage");
    if (isBiometricAddition(op.operation)) {
      await assertBiometricAllowed(ctx, device?.projectId);
      await assertBiometricAllowed(ctx, await biometricPayloadProject(ctx, op.payload));
    }
    if (mobileOperationId(op.payload) !== undefined) return { queued: false };
    if (!canRetrySync(op.status)) return { queued: false };
    const unresolved = isPersonDeletion(op) ? deletionUnresolvableReason(op, device) : undefined;
    if (unresolved) return { queued: false, reason: unresolved };
    const cardNumber = deletionIdentity(op);
    if (isPersonDeletion(op) && cardNumber && await protectCurrentCredential(ctx, op.deviceId, cardNumber)) {
      await supersedeDeletion(ctx, op._id);
      return { queued: false };
    }
    if (device?.brand === "hikvision" && device.hikTransport !== "localBridge") {
      await ctx.db.patch(op._id, { status: "failed", nextRetryAt: Date.now(), attemptCount: 0, dismissedAt: undefined, dismissedBy: undefined });
      await ctx.scheduler.runAfter(0, internal.actions.hikQueueWorker.processHikOperation, { issueId: op._id });
      return { queued: true };
    }
    if (!device || device.brand !== "hikvision" || device.hikTransport !== "localBridge") throw new Error("Bu cihaz için tek işlem yeniden denemesi desteklenmiyor; cihaz sayfasını kullanın");
    await ctx.db.patch(op._id, {
      status: "pending", nextRetryAt: Date.now(),
      attemptCount: 0, processingStartedAt: undefined, completedAt: undefined, claimedBy: undefined,
      dismissedAt: undefined, dismissedBy: undefined, lastError: undefined,
    });
    await scheduleBridgeWakeForProject(ctx, device.projectId);
    return { queued: true };
  },
});

/** Recheck at the action boundary, including operations scheduled before disabling. */
export const assertBiometricSyncAllowed = internalQuery({
  args: { employeeId: v.id("employees"), deviceId: v.optional(v.id("devices")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Çalışan bulunamadı");
    await assertBiometricAllowed(ctx, employee.projectId);
    if (args.deviceId) {
      const device = await ctx.db.get(args.deviceId);
      if (!device) throw new Error("Cihaz bulunamadı");
      await assertBiometricAllowed(ctx, device.projectId);
    }
    return null;
  },
});

const SUPERSEDED_DELETION = "Yerine geçildi: bu kartın cihazda güncel erişim yetkisi var";
const isPersonDeletion = (op: Doc<"hikPendingOperations">) => ["deletePerson", "deleteCard"].includes(op.operation);
const deletionIdentity = (op: Doc<"hikPendingOperations">) => {
  const payload = asRecord(op.payload);
  const value = payload.employeeNo ?? payload.cardNumber;
  return typeof value === "string" && value.trim() ? value : undefined;
};

function deletionUnresolvableReason(op: Doc<"hikPendingOperations">, device: Doc<"devices"> | null): string | undefined {
  if (!device) return "Cihaz bulunamadı";
  if (device.brand !== "hikvision" || device.projectId !== op.projectId) return "Silme hedefi proje dışında veya cihaz türü değişmiş";
  if (!deletionIdentity(op)) return "Silme işi eski kart kimliğini içermiyor";
  if (device.hikTransport !== "localBridge" && !device.hikDevIndex) return "Cihaz gateway'e kayıtlı değil";
  return undefined;
}

async function supersedeDeletion(ctx: MutationCtx, id: Id<"hikPendingOperations">) {
  await ctx.db.patch(id, { status: "done", completedAt: Date.now(), lastError: SUPERSEDED_DELETION });
}

async function supersedeDeletions(ctx: MutationCtx, deviceId: Id<"devices">, cardNumber: string) {
  // Pending/processing rows are checked individually at claim/dispatch, not on every add ack.
  const rows = await ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", deviceId).eq("status", "failed")).take(4096);
  for (const op of rows) if (isPersonDeletion(op) && deletionIdentity(op) === cardNumber) {
    // Supersession is not a device deletion acknowledgement: never mark a grant removed.
    await supersedeDeletion(ctx, op._id);
  }
}

async function protectCurrentCredential(ctx: MutationCtx, deviceId: Id<"devices">, cardNumber: string) {
  const device = await ctx.db.get(deviceId);
  if (!device) return false;
  const employees = await ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", cardNumber)).take(101);
  if (employees.length > 100) throw new Error("Kart sahibi sınırı aşıldı");
  for (const employee of employees) {
    if (employee.projectId !== device.projectId || employee.isActive === false) continue;
    if (await hasWritableHikCredential(ctx, employee, device)) {
      await supersedeDeletions(ctx, deviceId, cardNumber);
      return true;
    }
  }
  return false;
}

export const protectPersonDeletion = internalMutation({
  args: { deviceId: v.id("devices"), cardNumber: v.string() },
  handler: (ctx, args) => protectCurrentCredential(ctx, args.deviceId, args.cardNumber),
});
export const protectQueuedDeletion = internalMutation({
  args: { id: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    const op = await ctx.db.get(args.id);
    if (!op || op.status === "done" || op.dismissedAt !== undefined) return true;
    const cardNumber = deletionIdentity(op);
    const protectedCredential = isPersonDeletion(op) && cardNumber !== undefined && await protectCurrentCredential(ctx, op.deviceId, cardNumber);
    if (protectedCredential) await supersedeDeletion(ctx, op._id);
    return protectedCredential;
  },
});
// Addition cleanup is best-effort: no matching failed deletion means no access-graph read.
async function supersedeCurrentCredentialDeletions(ctx: MutationCtx, deviceId: Id<"devices">, cardNumber: string) {
  const failed = await ctx.db.query("hikPendingOperations")
    .withIndex("by_device_status", q => q.eq("deviceId", deviceId).eq("status", "failed"))
    .take(4096);
  if (!failed.some(op => isPersonDeletion(op) && deletionIdentity(op) === cardNumber)) return false;
  return protectCurrentCredential(ctx, deviceId, cardNumber);
}

export const supersedePersonDeletions = internalMutation({
  args: { deviceId: v.id("devices"), cardNumber: v.string() },
  // A revocation may have committed while the add request was in flight.
  handler: (ctx, args) => supersedeCurrentCredentialDeletions(ctx, args.deviceId, args.cardNumber),
});

/** Only durable, project-scoped deletion identities may outlive a person record. */
export async function pendingPersonDeletions(ctx: Pick<QueryCtx, "db">, args: { projectId: Id<"projects">; employeeId: Id<"employees">; deviceId: Id<"devices"> }) {
  const rows = (await Promise.all((["failed", "pending", "processing"] as const).map(status =>
    ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", args.deviceId).eq("status", status)).take(1001),
  ))).flat();
  if (rows.length > 1000) throw new Error("Silme kuyruğu sınırı aşıldı; cihaz kapsamını daraltın");
  return rows.flatMap(row => {
    const payload = asRecord(row.payload);
    const cardNumber = payload.employeeNo ?? payload.cardNumber;
    return row.dismissedAt === undefined && row.projectId === args.projectId && payload.employeeId === args.employeeId &&
      ["deletePerson", "deleteCard"].includes(row.operation) && typeof cardNumber === "string" && cardNumber.trim()
      ? [{ id: row._id, cardNumber }] : [];
  });
}
export const getPendingPersonDeletions = internalQuery({
  args: { projectId: v.id("projects"), employeeId: v.id("employees"), deviceId: v.id("devices") },
  handler: pendingPersonDeletions,
});
