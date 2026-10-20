import { mobileOperationId, mobileQueueAllowed } from "./lib/mobileAccess";
import { assertBiometricAllowed, biometricPayloadProject, isBiometricAddition } from "./lib/biometricGate";
import { isBiometricEnabled } from "./lib/privacySettings";
import { v } from "convex/values";
import { scheduleBridgeWakeForProject } from "./hikBridge";
import { internalQuery, internalMutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation, adminMutation } from "./lib/customFunctions";
import { getCurrentUser, getValidAuthUserId } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";
import { scanHikSync, assertSyncScope } from "./lib/syncStatusScope";
import { canRetrySync, syncDismissPatch } from "./lib/syncStatusLogic";

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
    runId: v.optional(v.id("deviceSyncRuns")),
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
    await scheduleBridgeWakeForProject(ctx, device.projectId);
    return opId;
  },
});

function isLocalBridgeDevice(device: Doc<"devices"> | null): device is Doc<"devices"> {
  return device !== null && device.brand === "hikvision" && device.hikTransport === "localBridge";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asKeyPart(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
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
 * Detay gerekiyorsa adminQuery yazılmalı.
 */
export const listSyncIssues = query({
  args: { projectId: v.optional(v.id("projects")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!(await getValidAuthUserId(ctx))) return { items: [], hasMore: false, unknown: false };
    await getCurrentUser(ctx);
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
        operation: op.operation, deviceBrand: device?.brand ?? null, attemptCount: op.attemptCount, attempts: op.attemptCount, maxAttempts: 5, canRetry: device?.hikTransport === "localBridge",
      };
    }));
    return { items, hasMore: scan.hasMore || visible.length > max, unknown: scan.unknown };
  },
});

/**
 * Kullanıcı uyarıyı kapatır; operasyon sonucu korunur.
 */
export const dismissSyncIssue = authedMutation({
  args: { issueId: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx);
    const op = await ctx.db.get(args.issueId);
    if (!op) return;
    await assertSyncScope(ctx, projectIds, op);
    if (op.status !== "failed" || op.dismissedAt !== undefined) return;
    await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, Date.now()));
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
        .filter((f) => f.attemptCount < args.maxAttempts && mobileOperationId(f.payload) === undefined)
        .slice(0, args.limit * 2)
        .map(async (f) => {
          const device = await ctx.db.get(f.deviceId);
          if (!device || device.brand !== "hikvision" || !device.hikDevIndex) {
            return null;
          }
          if (isBiometricAddition(f.operation) && !(await isBiometricEnabled(ctx, device.projectId))) return null;
          // Online değil → bu tick'te atla, bir sonraki tick'te kontrol edilecek.
          if (!device.hikLastSeenAt || device.hikLastSeenAt < onlineCutoff) {
            return null;
          }

          const payload = (f.payload ?? {}) as Record<string, unknown>;
          const employeeId = payload.employeeId as Id<"employees"> | undefined;
          const employee = employeeId ? await ctx.db.get(employeeId) : null;
          if (isBiometricAddition(f.operation) && !(await isBiometricEnabled(ctx, employee?.projectId))) return null;

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
      // Run evidence belongs to that attempt; a later enqueue is not its delivery proof.
      if (f.runId) continue;
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
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    if (args.issueIds && args.issueIds.length > 100) throw new Error("Bir seferde en fazla 100 uyarı kapatılabilir");
    const scan = await scanHikSync(ctx, projectIds, ["failed"], true);
    const requested = args.issueIds
      ? (await Promise.all([...new Set(args.issueIds)].map((id) => ctx.db.get(id))))
        .filter((op): op is NonNullable<typeof op> => op !== null)
      : scan.rows;
    // Önizleme ile aynı kimlikler; yeni gelen uyarılar toplu kapatmaya dahil edilmez.
    for (const op of requested) await assertSyncScope(ctx, projectIds, op);
    const targets = requested.filter((op) => op.status === "failed" && op.dismissedAt === undefined).slice(0, 100);
    const now = Date.now();
    for (const op of targets) {
      await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
    }
    return { count: targets.length, hasMore: scan.hasMore || scan.rows.length > targets.length, unknown: scan.unknown };
  },
});

/** Tek op yeniden sıraya alınır; bridge claim/ack akışı değişmez. */
export const retrySyncIssue = adminMutation({
  args: { issueId: v.id("hikPendingOperations") },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx);
    const op = await ctx.db.get(args.issueId);
    if (!op) throw new Error("İşlem bulunamadı");
    const device = await assertSyncScope(ctx, projectIds, op);
    if (isBiometricAddition(op.operation)) {
      await assertBiometricAllowed(ctx, device?.projectId);
      await assertBiometricAllowed(ctx, await biometricPayloadProject(ctx, op.payload));
    }
    if (mobileOperationId(op.payload) !== undefined) return { queued: false };
    if (!canRetrySync(op.status)) return { queued: false };
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
