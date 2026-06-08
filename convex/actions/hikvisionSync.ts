"use node";

import { internal } from "../_generated/api";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { authedAction } from "../lib/customFunctions";
import { isProjectAllowed } from "../lib/auth";
import { filterHikvisionDevices, defaultRuleSchedule } from "../lib/hikSync";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  upsertPersonToDevice,
  deletePersonFromDevice,
  addCardToDevice,
  setWeekPlanOnDevice,
  setPlanTemplate,
  addFaceToDevice,
  deleteFaceFromDevice,
  addFingerprintToDevice,
  deleteFingerprintFromDevice,
} from "../lib/hikGateway";

/**
 * Proje kapsam denetimi. Scheduler/internal tetikli çağrılar `allowedProjectIds`
 * vermez → güvenilir kabul edilir (tetikleyen mutation zaten yetki denetledi; tüm
 * projelere izinli sayılır ama orphan projectId hâlâ atlanır). Public authed wrapper
 * kullanıcının eriştiği proje ID'lerini geçirir ve kapsam zorlanır.
 */
function makeProjectGuard(
  allowed: Id<"projects">[] | undefined,
): (pid: Id<"projects"> | undefined) => boolean {
  return (pid) => (allowed === undefined ? !!pid : isProjectAllowed(allowed, pid));
}

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
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const isAllowed = makeProjectGuard(args.allowedProjectIds);
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });

    if (!data?.employee.cardNumber || data.deviceRules.length === 0) {
      return { synced: 0, failed: 0, errors: [] };
    }
    if (!isAllowed(data.employee.projectId)) {
      return { synced: 0, failed: 0, errors: ["Bu çalışana erişim yetkiniz yok"] };
    }

    // Pasif çalışan cihazlardan silinmeli — cihazda kalırsa erişim 24/7 geçerli kalır
    // (Valid.enable cihazda true olarak yazılıydı). isActive: false olunca delete tetiklenir.
    if (data.employee.isActive === false) {
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
        employeeId: args.employeeId,
        allowedProjectIds: args.allowedProjectIds,
      });
      return { synced: 0, failed: 0, errors: [] };
    }

    const { employee, deviceRules } = data;
    const errors: string[] = [];
    const seen = new Set<string>();

    type Task = { kind: "skip" | "sync"; device: typeof deviceRules[number]["device"]; rule: typeof deviceRules[number]["rule"]; reason?: string };
    const tasks: Task[] = [];
    // Non-Hikvision cihazlar (QR, vs.) bu pipeline'a hiç girmez — silent skip.
    const hikRules = deviceRules.filter((dr) => dr.device.brand === "hikvision");
    for (const { device, rule } of hikRules) {
      if (!isAllowed(device.projectId)) {
        tasks.push({ kind: "skip", device, rule, reason: "erişim yetkiniz yok" });
        continue;
      }
      if (!device.hikDevIndex) {
        tasks.push({ kind: "skip", device, rule, reason: "gateway'e kayıtlı değil" });
        continue;
      }
      if (seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      tasks.push({ kind: "sync", device, rule });
    }

    // Eksik hikWeekPlanNo'ları topluca ata (action içinde DB write yok, mutation gerekli).
    const rulesNeedingNo = Array.from(
      new Set(
        tasks
          .filter((t) => t.kind === "sync" && !t.rule.hikWeekPlanNo)
          .map((t) => t.rule._id),
      ),
    );
    const newlyAssigned = new Map<Id<"accessRules">, number>();
    if (rulesNeedingNo.length > 0) {
      let maxNo = await ctx.runQuery(internal.hikvisionSync.getMaxWeekPlanNo, {});
      for (const ruleId of rulesNeedingNo) {
        maxNo += 1;
        await ctx.runMutation(internal.hikvisionSync.assignWeekPlanNo, {
          accessRuleId: ruleId,
          weekPlanNo: maxNo,
        });
        newlyAssigned.set(ruleId, maxNo);
      }
    }
    const resolveWeekPlanNo = (rule: { _id: Id<"accessRules">; hikWeekPlanNo?: number }) =>
      rule.hikWeekPlanNo ?? newlyAssigned.get(rule._id);

    const results = await Promise.all(
      tasks.map(async (t) => {
        if (t.kind === "skip") {
          return {
            ok: false,
            device: t.device,
            operation: "addPerson" as const,
            error: `${t.device.name}: ${t.reason}`,
          };
        }

        // Cihazda planTemplateNo'nun bind edileceği template + week plan zorunlu —
        // yoksa cihaz "no permission" döner ve fallback Template/1 (default 24/7)
        // istenmeyen yetki üretirdi.
        const planNo = resolveWeekPlanNo(t.rule);
        if (!planNo) {
          return {
            ok: false,
            device: t.device,
            operation: "addPerson" as const,
            error: `${t.device.name}: kuralın hikWeekPlanNo'su atanamadı`,
          };
        }
        const schedule = defaultRuleSchedule(t.rule);
        const wpRes = await setWeekPlanOnDevice(t.device.hikDevIndex!, planNo, schedule);
        if (wpRes.ok) {
          await setPlanTemplate(t.device.hikDevIndex!, planNo, {
            weekPlanNo: planNo,
            templateName: t.rule.name ?? `Rule ${planNo}`,
          });
        }

        console.log(
          `[hik-sync] Kişi → ${employee.cardNumber} → device(${t.device.name})`,
        );
        const personResult = await upsertPersonToDevice(t.device.hikDevIndex!, {
          employeeNo: employee.cardNumber,
          name: `${employee.firstName} ${employee.lastName}`,
          planTemplateNo: planNo,
          doorCount: t.device.hikDoorCount,
        });
        if (!personResult.ok) {
          return {
            ok: false,
            device: t.device,
            operation: "addPerson" as const,
            error: `${t.device.name} (person): ${personResult.error ?? "?"}`,
          };
        }
        const cardResult = await addCardToDevice(t.device.hikDevIndex!, {
          employeeNo: employee.cardNumber,
          cardNo: employee.cardNumber,
          cardType: "normalCard",
        });
        // alreadyExists hata değil (idempotent); diğer hata varsa warn.
        if (!cardResult.ok && !cardResult.alreadyExists) {
          console.warn(
            `[hik-sync] kart eklerken uyarı (${t.device.name}): ${cardResult.error}`,
          );
        }
        return { ok: true as const, device: t.device };
      }),
    );

    let synced = 0;
    let failed = 0;
    const failureWrites: Promise<unknown>[] = [];
    const successDeviceIds: Id<"devices">[] = [];
    for (const r of results) {
      if (r.ok) {
        synced++;
        successDeviceIds.push(r.device._id);
        continue;
      }
      failed++;
      if (r.error) errors.push(r.error);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.device._id,
          projectId: r.device.projectId,
          operation: r.operation,
          lastError: r.error,
          payload: { employeeId: args.employeeId },
        }),
      );
    }
    await Promise.all([
      ...failureWrites,
      ...resolveSuccesses(ctx, successDeviceIds, ["addPerson", "updatePerson", "addCard"], {
        employeeId: args.employeeId,
      }),
    ]);
    return { synced, failed, errors };
  },
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
    return await ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
      employeeId: args.employeeId,
      allowedProjectIds,
    });
  },
});

type ResolveOp =
  | "addPerson"
  | "updatePerson"
  | "deletePerson"
  | "addCard"
  | "deleteCard"
  | "addFace"
  | "deleteFace"
  | "addFingerprint"
  | "deleteFingerprint"
  | "syncWeekPlan"
  | "syncHoliday"
  | "syncDoorParam"
  | "openDoor";

/**
 * Başarılı sync sonrası ilgili cihazlardaki eski failure'ları done yap.
 * Her cihaz için ayrı bir mutation çağırır (resolveTargetFailures `by_device_status`
 * index'ini cihaz başına seek eder; tek mutation'a sığdırmanın değeri yok).
 */
function resolveSuccesses(
  ctx: ActionCtx,
  deviceIds: Id<"devices">[],
  operations: ResolveOp[],
  target: { employeeId?: Id<"employees">; accessRuleId?: Id<"accessRules"> },
): Promise<unknown>[] {
  return deviceIds.map((deviceId) =>
    ctx.runMutation(internal.hikvisionSync.resolveTargetFailures, {
      deviceId,
      operations,
      employeeId: target.employeeId,
      accessRuleId: target.accessRuleId,
    }),
  );
}

/**
 * Çalışanı tüm gateway-cihazlarından siler (employeeNo bazlı).
 * Yalnızca scheduler/internal tetikli (frontend doğrudan çağırmaz) → internalAction.
 */
export const deleteEmployeeFromDevicesInternal = internalAction({
  args: {
    employeeId: v.id("employees"),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ removed: number; failed: number; errors: string[] }> => {
    const isAllowed = makeProjectGuard(args.allowedProjectIds);
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data?.employee.cardNumber || data.deviceRules.length === 0) {
      return { removed: 0, failed: 0, errors: [] };
    }
    if (!isAllowed(data.employee.projectId)) {
      return { removed: 0, failed: 0, errors: ["Bu çalışana erişim yetkiniz yok"] };
    }
    const seen = new Set<string>();
    type DelTarget = { deviceId: Id<"devices">; projectId?: Id<"projects">; name: string; devIndex: string };
    const targets: DelTarget[] = [];
    const skipped: { device: typeof data.deviceRules[number]["device"]; reason: string }[] = [];
    const hikDeviceRules = data.deviceRules.filter(
      (dr) => dr.device.brand === "hikvision",
    );
    for (const { device } of hikDeviceRules) {
      if (!isAllowed(device.projectId)) {
        skipped.push({ device, reason: "bu cihaza erişim yetkiniz yok" });
        continue;
      }
      if (!device.hikDevIndex) {
        skipped.push({ device, reason: "gateway'e kayıtlı değil" });
        continue;
      }
      if (seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      targets.push({
        deviceId: device._id,
        projectId: device.projectId,
        name: device.name,
        devIndex: device.hikDevIndex,
      });
    }
    const results = await Promise.all(
      targets.map((t) =>
        deletePersonFromDevice(t.devIndex, data.employee.cardNumber).then((r) => ({
          ...r,
          target: t,
        })),
      ),
    );

    const errors: string[] = [];
    let removed = 0;
    let failed = 0;
    const failureWrites: Promise<unknown>[] = [];
    for (const s of skipped) {
      failed++;
      errors.push(`${s.device.name}: ${s.reason}`);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: s.device._id,
          projectId: s.device.projectId,
          operation: "deletePerson",
          lastError: s.reason,
          payload: { employeeId: args.employeeId },
        }),
      );
    }
    const successDeviceIds: Id<"devices">[] = [];
    for (const r of results) {
      if (r.ok) {
        removed++;
        successDeviceIds.push(r.target.deviceId);
        continue;
      }
      failed++;
      const errMsg = r.error ?? "Bilinmeyen hata";
      errors.push(`${r.target.name}: ${errMsg}`);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.target.deviceId,
          projectId: r.target.projectId,
          operation: "deletePerson",
          lastError: errMsg,
          payload: { employeeId: args.employeeId },
        }),
      );
    }
    await Promise.all([
      ...failureWrites,
      ...resolveSuccesses(
        ctx,
        successDeviceIds,
        ["deletePerson", "deleteCard", "deleteFace", "deleteFingerprint"],
        { employeeId: args.employeeId },
      ),
    ]);
    return { removed, failed, errors };
  },
});

/**
 * Erişim kuralındaki haftalık planı gateway-cihazlara push eder,
 * sonra gruptaki çalışanları güncel planTemplateNo ile yeniden sync eder.
 */
export const syncWeekPlanToDevicesInternal = internalAction({
  args: {
    accessRuleId: v.id("accessRules"),
    allowedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    synced: number;
    failed: number;
    errors: string[];
    employeesSynced: number;
  }> => {
    const isAllowed = makeProjectGuard(args.allowedProjectIds);
    const data = await ctx.runQuery(internal.hikvisionSync.getAccessRuleWithDevices, {
      accessRuleId: args.accessRuleId,
    });

    if (!data) return { synced: 0, failed: 0, errors: [], employeesSynced: 0 };

    const { rule, devices, employees } = data;
    if (!isAllowed(rule.projectId)) {
      return {
        synced: 0,
        failed: 0,
        errors: ["Bu erişim kuralına yetkiniz yok"],
        employeesSynced: 0,
      };
    }
    if (devices.length === 0) {
      return { synced: 0, failed: 0, errors: [], employeesSynced: 0 };
    }

    // hikWeekPlanNo yoksa ata
    let weekPlanNo = rule.hikWeekPlanNo;
    if (!weekPlanNo) {
      const maxNo = await ctx.runQuery(internal.hikvisionSync.getMaxWeekPlanNo, {});
      weekPlanNo = maxNo + 1;
      await ctx.runMutation(internal.hikvisionSync.assignWeekPlanNo, {
        accessRuleId: args.accessRuleId,
        weekPlanNo,
      });
    }

    const schedule = defaultRuleSchedule(rule);

    const errors: string[] = [];
    const skippedDevices: { device: typeof devices[number]; reason: string }[] = [];
    const hikDevices = filterHikvisionDevices(devices);
    const allowedDevices = hikDevices.filter((d) => {
      if (!isAllowed(d.projectId)) {
        skippedDevices.push({ device: d, reason: "bu cihaza erişim yetkiniz yok" });
        return false;
      }
      if (!d.hikDevIndex) {
        skippedDevices.push({ device: d, reason: "gateway'e kayıtlı değil" });
        return false;
      }
      return true;
    });
    const failureWrites: Promise<unknown>[] = [];
    for (const s of skippedDevices) {
      errors.push(`${s.device.name}: ${s.reason}`);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: s.device._id,
          projectId: s.device.projectId,
          operation: "syncWeekPlan",
          lastError: s.reason,
          payload: { accessRuleId: args.accessRuleId },
        }),
      );
    }

    // Week plan + Plan Template birlikte push edilir — cihaz kişiyi `planTemplateNo`
    // ile bind ediyor; template, week plan'a referans verir. İkisi de set edilmezse
    // cihaz lokal karar olarak "no permission" döner.
    const planResults = await Promise.all(
      allowedDevices.map(async (d) => {
        const wp = await setWeekPlanOnDevice(d.hikDevIndex!, weekPlanNo, schedule);
        if (!wp.ok) return { ...wp, device: d };
        // Aynı numarayı template no olarak da kullan — basitlik için 1-1 eşleme.
        const tpl = await setPlanTemplate(d.hikDevIndex!, weekPlanNo, {
          weekPlanNo,
          templateName: rule.name ?? `Rule ${weekPlanNo}`,
        });
        return { ...tpl, device: d };
      }),
    );
    let synced = 0;
    let failed = skippedDevices.length;
    const successDeviceIds: Id<"devices">[] = [];
    for (const r of planResults) {
      if (r.ok) {
        synced++;
        successDeviceIds.push(r.device._id);
        continue;
      }
      failed++;
      const errMsg = r.error ?? "Bilinmeyen hata";
      errors.push(`${r.device.name}: ${errMsg}`);
      failureWrites.push(
        ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.device._id,
          projectId: r.device.projectId,
          operation: "syncWeekPlan",
          lastError: errMsg,
          payload: { accessRuleId: args.accessRuleId, weekPlanNo },
        }),
      );
    }
    await Promise.all([
      ...failureWrites,
      ...resolveSuccesses(ctx, successDeviceIds, ["syncWeekPlan"], {
        accessRuleId: args.accessRuleId,
      }),
    ]);

    // Gruptaki çalışanları güncel plan ile sync et — device x employee matrisi paralel
    const employeeSyncs = await Promise.all(
      allowedDevices.flatMap((d) =>
        employees.map(async (emp) => {
          const r = await upsertPersonToDevice(d.hikDevIndex!, {
            employeeNo: emp.cardNumber,
            name: `${emp.firstName} ${emp.lastName}`,
            planTemplateNo: weekPlanNo,
            doorCount: d.hikDoorCount,
          });
          if (!r.ok) return false;
          await addCardToDevice(d.hikDevIndex!, {
            employeeNo: emp.cardNumber,
            cardNo: emp.cardNumber,
            cardType: "normalCard",
          });
          return true;
        }),
      ),
    );
    const employeesSynced = employeeSyncs.filter(Boolean).length;

    return { synced, failed, errors, employeesSynced };
  },
});

/**
 * UI'dan manuel kural sync'i için public authed sarmalayıcı.
 */
export const syncWeekPlanToDevices = authedAction({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    synced: number;
    failed: number;
    errors: string[];
    employeesSynced: number;
  }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    return await ctx.runAction(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
      accessRuleId: args.accessRuleId,
      allowedProjectIds,
    });
  },
});

/**
 * Bir projedeki tüm aktif access rule'ları cihazlara push eder.
 * Mevcut kayıtların ilk kez Hikvision tarafına geçirilmesi için kullanılır
 * (mutation trigger'ları yeni; eski kurallar UI'dan tek tıkla backfill edilir).
 */
export const backfillAllRulesToDevices = authedAction({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (
    ctx,
    args,
  ): Promise<{ rulesProcessed: number; synced: number; failed: number; errors: string[] }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    let scope: Id<"projects">[];
    if (args.projectId) {
      if (!isProjectAllowed(allowedProjectIds, args.projectId)) {
        return { rulesProcessed: 0, synced: 0, failed: 0, errors: ["Bu projeye yetkiniz yok"] };
      }
      scope = [args.projectId];
    } else {
      scope = allowedProjectIds;
    }
    const ruleIds: Id<"accessRules">[] = await ctx.runQuery(
      internal.hikvisionSync.listActiveRuleIdsForBackfill,
      { projectIds: scope },
    );
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    // Sıralı çağrı — paralel push gateway'i boğmasın (her kural N cihaz x M çalışan).
    for (const rid of ruleIds) {
      try {
        const res = await ctx.runAction(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
          accessRuleId: rid,
          allowedProjectIds: scope,
        });
        synced += res.synced;
        failed += res.failed;
        for (const e of res.errors) errors.push(e);
      } catch (e) {
        failed++;
        errors.push((e as Error).message);
      }
    }
    return { rulesProcessed: ruleIds.length, synced, failed, errors };
  },
});

// ============================================================================
// FACE — sync/delete (Phase 3)
// ============================================================================

export const syncEmployeeFaceToDevices = authedAction({
  args: { employeeId: v.id("employees") },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
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
      if (!isProjectAllowed(allowedProjectIds, device.projectId)) continue;
      if (!device.hikDevIndex || seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      targets.push({ device });
    }

    const employeeNo = data.employee.cardNumber;
    const results = await Promise.all(
      targets.map(async (t) => {
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

export const deleteEmployeeFaceFromDevices = authedAction({
  args: { employeeId: v.id("employees") },
  handler: async (
    ctx,
    args,
  ): Promise<{ removed: number; failed: number; errors: string[] }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { removed: 0, failed: 0, errors: [] };

    const seen = new Set<string>();
    const targets: { device: typeof data.deviceRules[number]["device"] }[] = [];
    const hikRules = data.deviceRules.filter((dr) => dr.device.brand === "hikvision");
    for (const { device } of hikRules) {
      if (!isProjectAllowed(allowedProjectIds, device.projectId)) continue;
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

export const syncEmployeeFingerprintToDevices = authedAction({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { synced: 0, failed: 0, errors: [] };

    const fp = await ctx.runQuery(internal.employeeFingerprints.getOne, {
      employeeId: args.employeeId,
      fingerPrintID: args.fingerPrintID,
    });
    if (!fp) {
      return { synced: 0, failed: 0, errors: ["Parmak izi şablonu bulunamadı"] };
    }

    const seen = new Set<string>();
    const targets: { device: typeof data.deviceRules[number]["device"] }[] = [];
    const hikRules = data.deviceRules.filter((dr) => dr.device.brand === "hikvision");
    for (const { device } of hikRules) {
      if (!isProjectAllowed(allowedProjectIds, device.projectId)) continue;
      if (!device.hikDevIndex || seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      targets.push({ device });
    }

    const employeeNo = data.employee.cardNumber;
    const results = await Promise.all(
      targets.map(async (t) => {
        const r = await addFingerprintToDevice(t.device.hikDevIndex!, {
          employeeNo,
          fingerPrintID: args.fingerPrintID,
          fingerData: fp.fingerData,
          fingerType: (fp.fingerType as "normalFP" | undefined) ?? "normalFP",
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
          operation: "addFingerprint",
          lastError: msg,
          payload: { employeeId: args.employeeId, fingerPrintID: args.fingerPrintID },
        }),
      );
    }
    await Promise.all(failureWrites);
    return { synced, failed, errors };
  },
});

export const deleteEmployeeFingerprintFromDevices = authedAction({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ removed: number; failed: number; errors: string[] }> => {
    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { removed: 0, failed: 0, errors: [] };

    const seen = new Set<string>();
    const targets: { device: typeof data.deviceRules[number]["device"] }[] = [];
    const hikRules = data.deviceRules.filter((dr) => dr.device.brand === "hikvision");
    for (const { device } of hikRules) {
      if (!isProjectAllowed(allowedProjectIds, device.projectId)) continue;
      if (!device.hikDevIndex || seen.has(device.hikDevIndex)) continue;
      seen.add(device.hikDevIndex);
      targets.push({ device });
    }

    const employeeNo = data.employee.cardNumber;
    const results = await Promise.all(
      targets.map(async (t) => {
        const r = await deleteFingerprintFromDevice(
          t.device.hikDevIndex!,
          employeeNo,
          args.fingerPrintID,
        );
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
          operation: "deleteFingerprint",
          lastError: msg,
          payload: { employeeId: args.employeeId, fingerPrintID: args.fingerPrintID },
        }),
      );
    }
    await Promise.all(failureWrites);
    return { removed, failed, errors };
  },
});
