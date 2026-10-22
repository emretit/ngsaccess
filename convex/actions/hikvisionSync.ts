"use node";

import { internal } from "../_generated/api";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { authedAction } from "../lib/customFunctions";
import {
  makeProjectGuard,
  bridgeDedupeKey,
  removeScopedPerson,
  syncEmployeeDevices,
  syncWeekPlanDevices,
} from "../lib/hikSyncEmployee";
import type { Id } from "../_generated/dataModel";
import {
  setWeekPlanOnDevice,
  setPlanTemplate,
  addFaceToDevice,
  deleteFaceFromDevice,
} from "../lib/hikGateway";

/**
 * Çalışanı erişim gruplarındaki tüm cihazlara senkronize eder.
 * Convex → Hetzner Gateway (HTTP Digest) → ISUP 5.0 → Cihaz (LAN).
 *
 * Cihazlara doğrudan değil, gateway ISAPI passthrough üzerinden bağlanır.
 * devices.hikDevIndex set edilmiş cihazlar dikkate alınır.
 *
 * internalAction: scheduler (employees/accessRules/visitors mutation'ları) ve UI'ın
 * authed wrapper'ı (`syncEmployeeToDevices`) tarafından tetiklenir. Scheduler auth
 * identity taşımadığı için authedAction burada "Giriş yapmanız gerekiyor" fırlatırdı.
 */
export const syncEmployeeToDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    runId: v.optional(v.id("deviceSyncRuns")),
    targetDeviceIds: v.optional(v.array(v.id("devices"))),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
    retrying: v.optional(v.boolean()),
  },
  handler: syncEmployeeDevices,
});

/**
 * UI'dan manuel "cihazlara sync" için public authed sarmalayıcı. Kullanıcının
 * eriştiği proje ID'lerini çözüp internal core'a kapsam olarak geçirir (IDOR önler).
 */
export const syncEmployeeToDevices = authedAction({
  args: { employeeId: v.id("employees") },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const employee = await ctx.runQuery(internal.devices.getEmployeeByIdInternal, { employeeId: args.employeeId });
    if (!employee) throw new Error("Çalışan bulunamadı");
    const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: employee.projectId, permission: "accessRules.manage" });
    if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
    return await ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
      employeeId: args.employeeId,
      allowedProjectIds,
    });
  },
});

/**
 * Çalışanı tüm gateway-cihazlarından siler (employeeNo bazlı).
 * Yalnızca scheduler/internal tetikli (frontend doğrudan çağırmaz) → internalAction.
 */
export const deleteEmployeeFromDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    syncAfter: v.optional(v.boolean()),
    runId: v.optional(v.id("deviceSyncRuns")),
    targetDeviceIds: v.optional(v.array(v.id("devices"))),
    snapshot: v.optional(v.object({
      cardNumber: v.string(),
      projectId: v.optional(v.id("projects")),
      devices: v.array(v.object({
        _id: v.id("devices"), name: v.string(),
        brand: v.optional(v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))),
        projectId: v.optional(v.id("projects")), hikDevIndex: v.optional(v.string()),
        hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
        hikDoorCount: v.optional(v.number()),
      })),
    })),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ removed: number; queued: number; failed: number; errors: string[]; superseded?: number }> => {
    const isAllowed = makeProjectGuard(args.allowedProjectIds);
    const data = args.snapshot ? {
      employee: args.snapshot,
      deviceRules: args.snapshot.devices.map(device => ({ device })),
    } : await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data?.employee.cardNumber) {
      return { removed: 0, queued: 0, failed: 0, errors: [] };
    }
    if (!isAllowed(data.employee.projectId)) {
      return { removed: 0, queued: 0, failed: 0, errors: ["Bu çalışana erişim yetkiniz yok"] };
    }
    const seen = new Set<string>();
    type DelTarget = { device: typeof data.deviceRules[number]["device"]; devIndex?: string };
    const targets: DelTarget[] = [];

    const deletionDevices = args.snapshot?.devices ?? ("previousDevices" in data ? data.previousDevices : []);
    const hikDeviceRules = deletionDevices.map(device => ({ device })).filter(
      (dr) => dr.device.brand === "hikvision" && (!args.targetDeviceIds || args.targetDeviceIds.includes(dr.device._id)),
    );
    for (const { device } of hikDeviceRules) {
      if (!isAllowed(device.projectId) || device.projectId !== data.employee.projectId) {
        continue;
      }
      const key = bridgeDedupeKey(device);
      const identity = key ?? device._id;
      if (seen.has(identity)) continue;
      seen.add(identity);
      targets.push({ device, devIndex: device.hikDevIndex });
    }
    const results = await Promise.all(
      targets.map(async (t) => {
        try {
          const r = await removeScopedPerson(ctx, t.device, args.employeeId, data.employee.cardNumber, args.runId);
          return { ...r, target: t };
        } catch {
          return { ok: false, error: "Silme hedefi işlenemedi; cihazda kalmış olabilir", target: t };
        }
      }),
    );

    const errors: string[] = [];
    let removed = 0;
    let superseded = 0;
    let queued = 0;
    let failed = 0;
    const failureWrites: Promise<unknown>[] = [];
    for (const r of results) {
      if (r.ok) {
        if (r.superseded) superseded++;
        else if (r.queued) queued++;
        else removed++;
        continue;
      }
      failed++;
      const errMsg = r.error ?? "Bilinmeyen hata";
      errors.push(`${r.target.device.name}: ${errMsg}`);
      if (!r.tracked) failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.target.device._id,
          projectId: r.target.device.projectId,
          operation: "deletePerson",
          lastError: errMsg,
          payload: { employeeId: args.employeeId, employeeNo: data.employee.cardNumber, cardNumber: data.employee.cardNumber },
        }),
      );
    }
    await Promise.all(failureWrites);
    if (args.syncAfter) await ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: args.employeeId });
    return { removed, queued, failed, errors, ...(superseded ? { superseded } : {}) };
  },
});

/**
 * Erişim kuralındaki haftalık planı gateway-cihazlara push eder,
 * sonra gruptaki çalışanları güncel planTemplateNo ile yeniden sync eder.
 */
export const syncWeekPlanToDevicesInternal = internalAction({
  args: {
    accessRuleId: v.id("accessRules"),
    targetEmployeeIds: v.optional(v.array(v.id("employees"))),
    runId: v.optional(v.id("deviceSyncRuns")),
    targetDeviceIds: v.optional(v.array(v.id("devices"))),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: syncWeekPlanDevices,
});

// ============================================================================
// FACE — sync/delete (Phase 3)
// ============================================================================

// Yüz/parmak izi action'ları yalnız scheduler tetikli (employeeFaces/employeeFingerprints
// mutation'ları yetkiyi zaten denetledi). Scheduler auth identity taşımadığı için
// authedAction burada "Giriş yapmanız gerekiyor" fırlatırdı → internalAction.

export const syncEmployeeFaceToDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    await ctx.runQuery(internal.hikvisionSync.assertBiometricSyncAllowed, { employeeId: args.employeeId });
    const inScope = makeProjectGuard(args.allowedProjectIds);
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { synced: 0, failed: 0, errors: [] };

    // Yüz blob'unu bir kez oku — ctx.storage.get sadece action ctx'inde mevcut.
    const face = await ctx.runQuery(internal.employeeFaces.getStorageRef, {
      employeeId: args.employeeId,
    });
    if (!face) return { synced: 0, failed: 0, errors: ["Bu çalışanın yüz fotoğrafı yok"] };
    const blob = await ctx.storage.get(face.pictureStorageId);
    if (!blob) {
      return { synced: 0, failed: 0, errors: ["Yüz dosyası storage'da bulunamadı"] };
    }
    const jpegBytes = new Uint8Array(await blob.arrayBuffer());

    const seen = new Set<string>();
    const targets: { device: typeof data.deviceRules[number]["device"] }[] = [];
    const hikRules = data.deviceRules.filter((dr) => dr.device.brand === "hikvision");
    for (const { device } of hikRules) {
      if (!inScope(device.projectId)) continue;
      if (!device.hikDevIndex || seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      targets.push({ device });
    }

    const employeeNo = data.employee.cardNumber;
    const results = await Promise.all(
      targets.map(async (t) => {
        await ctx.runQuery(internal.hikvisionSync.assertBiometricSyncAllowed, { employeeId: args.employeeId, deviceId: t.device._id });
        const r = await addFaceToDevice(t.device.hikDevIndex!, employeeNo, jpegBytes, {
          name: `${data.employee.firstName} ${data.employee.lastName}`,
        });
        return { ...r, device: t.device };
      }),
    );

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    const failureWrites: Promise<unknown>[] = [];
    for (const r of results) {
      if (r.ok) {
        synced++;
        continue;
      }
      failed++;
      const msg = r.error ?? "Bilinmeyen hata";
      errors.push(`${r.device.name}: ${msg}`);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.device._id,
          projectId: r.device.projectId,
          operation: "addFace",
          lastError: msg,
          payload: { employeeId: args.employeeId },
        }),
      );
    }
    await Promise.all(failureWrites);
    return { synced, failed, errors };
  },
});

export const deleteEmployeeFaceFromDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ removed: number; failed: number; errors: string[] }> => {
    const inScope = makeProjectGuard(args.allowedProjectIds);
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { removed: 0, failed: 0, errors: [] };

    const seen = new Set<string>();
    const targets: { device: typeof data.deviceRules[number]["device"] }[] = [];
    const hikRules = data.deviceRules.filter((dr) => dr.device.brand === "hikvision");
    for (const { device } of hikRules) {
      if (!inScope(device.projectId)) continue;
      if (!device.hikDevIndex || seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      targets.push({ device });
    }

    const employeeNo = data.employee.cardNumber;
    const results = await Promise.all(
      targets.map(async (t) => {
        const r = await deleteFaceFromDevice(t.device.hikDevIndex!, employeeNo);
        return { ...r, device: t.device };
      }),
    );

    let removed = 0;
    let failed = 0;
    const errors: string[] = [];
    const failureWrites: Promise<unknown>[] = [];
    for (const r of results) {
      if (r.ok) {
        removed++;
        continue;
      }
      failed++;
      const msg = r.error ?? "Bilinmeyen hata";
      errors.push(`${r.device.name}: ${msg}`);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.device._id,
          projectId: r.device.projectId,
          operation: "deleteFace",
          lastError: msg,
          payload: { employeeId: args.employeeId },
        }),
      );
    }
    await Promise.all(failureWrites);
    return { removed, failed, errors };
  },
});

// ============================================================================
// FINGERPRINT — sync/delete (Phase 3)
// ============================================================================

export const syncEmployeeFingerprintToDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: args.employeeId });
    if (!data || !makeProjectGuard(args.allowedProjectIds)(data.employee.projectId)) return { synced: 0, failed: 0, errors: [] };
    await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices, { employeeId: args.employeeId, fingerNo: args.fingerPrintID });
    return { synced: 0, failed: 0, errors: [] };
  },
});

export const deleteEmployeeFingerprintFromDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ removed: number; failed: number; errors: string[] }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: args.employeeId });
    if (!data || !makeProjectGuard(args.allowedProjectIds)(data.employee.projectId)) return { removed: 0, failed: 0, errors: [] };
    await ctx.runMutation(internal.fingerprintEnrollment.removeAllForEmployee, { employeeId: args.employeeId, employeeNo: data.employee.cardNumber, fingerNo: args.fingerPrintID });
    return { removed: 0, failed: 0, errors: [] };
  },
});

/** Template updates keep person RightPlans stable: direct gateway sends plans only. */
export const executeTemplateTarget = internalAction({
  args: { targetId: v.id("deviceSyncRunTargets"), ruleIds: v.array(v.id("accessRules")), changedRuleIds: v.array(v.id("accessRules")) },
  handler: async (ctx, args): Promise<void> => {
    const data = await ctx.runQuery(internal.deviceSyncRuns.loadTemplateTarget, { targetId: args.targetId, ruleIds: args.ruleIds });
    if (!data) return;
    let failure: string | undefined;
    const direct = data.device.brand === "hikvision" && data.device.hikTransport !== "localBridge";
    try {
      if (direct) {
        const index = data.device.hikDevIndex;
        if (!index) throw new Error("Gateway kaydı bulunamadı");
        for (const plan of data.plans) {
          const no = plan.rule.hikWeekPlanNo;
          if (!no) throw new Error("Hafta planı numarası bulunamadı");
          const week = await setWeekPlanOnDevice(index, no, plan.schedule);
          if (!week.ok) throw new Error(week.error ?? "Hafta planı gönderilemedi");
          const template = await setPlanTemplate(index, no, { weekPlanNo: no, templateName: plan.rule.name });
          if (!template.ok) throw new Error(template.error ?? "Plan şablonu gönderilemedi");
        }
      } else await ctx.runMutation(internal.deviceSyncRuns.enqueueTemplateTarget, args);
    } catch (error) { failure = error instanceof Error ? error.message : "Şablon gönderilemedi"; }
    await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: args.targetId, failure, directSent: direct,
      skipped: !data.plans.length && !failure ? "Cihaza bağlı şablon kuralı yok" : undefined });
  },
});
