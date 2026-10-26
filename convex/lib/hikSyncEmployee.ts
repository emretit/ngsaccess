"use node";

// Node-only sync implementation: import only from actions/hikvisionSync.ts.
// Employee and week-plan sync share plan caches and deletion helpers here.
import { accessEndsAtMs } from "./accessEnd";
import type { GrantResult } from "./grantStatus";
import type { FunctionReturnType } from "convex/server";
import { buildDoorPlans, hikValidBeginFromAccessStart, hikValidEndFromAccessEnd } from "./gateway/persons";
import { internal } from "../_generated/api";
import { isProjectAllowed } from "./auth";
import { filterHikvisionDevices, defaultRuleSchedule } from "./hikSync";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  upsertPersonToDevice,
  deletePersonFromDevice,
  addCardToDevice,
  setWeekPlanOnDevice,
  setPlanTemplate,
} from "./hikGateway";

/**
 * Proje kapsam denetimi. Scheduler/internal tetikli çağrılar `allowedProjectIds`
 * vermez → güvenilir kabul edilir (tetikleyen mutation zaten yetki denetledi; tüm
 * projelere izinli sayılır ama orphan projectId hâlâ atlanır). Public authed wrapper
 * kullanıcının eriştiği proje ID'lerini geçirir ve kapsam zorlanır.
 */
export function makeProjectGuard(
  allowed: Id<"projects">[] | undefined,
): (pid: Id<"projects"> | undefined) => boolean {
  return (pid) => (allowed === undefined ? !!pid : isProjectAllowed(allowed, pid));
}

type HikDeviceRef = {
  _id: Id<"devices">;
  name: string;
  brand?: "hikvision" | "other" | "ide_smart";
  projectId?: Id<"projects">;
  hikDevIndex?: string;
  hikTransport?: "gateway" | "localBridge";
  hikDoorCount?: number;
};

function isLocalBridgeDevice(device: HikDeviceRef): boolean {
  return device.brand === "hikvision" && device.hikTransport === "localBridge";
}

export function bridgeDedupeKey(device: HikDeviceRef): string | null {
  if (isLocalBridgeDevice(device)) return device._id;
  return device.hikDevIndex ?? null;
}

async function enqueueLocalBridgeOp(
  ctx: ActionCtx,
  device: HikDeviceRef,
  operation: ResolveOp,
  payload: Record<string, unknown>,
  runId?: Id<"deviceSyncRuns">,
): Promise<void> {
  await ctx.runMutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
    deviceId: device._id,
    projectId: device.projectId,
    operation,
    payload,
    runId,
  });
}

function doorCountFor(device: HikDeviceRef): number {
  return Math.max(1, device.hikDoorCount ?? (isLocalBridgeDevice(device) ? 4 : 1));
}

type EmployeeSyncData = FunctionReturnType<typeof internal.hikvisionSync.getEmployeeWithDevices>;
type SharedSync = {
  plans: Map<string, Promise<{ ok: boolean; error?: string }>>;
  numbers: Map<Id<"accessRules">, Promise<number>>;
  successes: Map<Id<"devices">, Id<"employees">[]>;
  grantResults: GrantResult[];
};

export async function removeScopedPerson(ctx: ActionCtx, device: HikDeviceRef, employeeId: Id<"employees">, cardNumber: string, runId?: Id<"deviceSyncRuns">): Promise<{ ok: boolean; error?: string; queued?: boolean; tracked?: boolean; superseded?: boolean }> {
  if (await ctx.runMutation(internal.hikvisionSync.protectPersonDeletion, { deviceId: device._id, cardNumber })) return { ok: true, superseded: true };
  if (isLocalBridgeDevice(device)) {
    await enqueueLocalBridgeOp(ctx, device, "deleteCard", { employeeId, employeeNo: cardNumber, cardNumber }, runId);
    return { ok: true, queued: true };
  }
  if (!device.projectId) return { ok: false, error: "Cihaz projesi bulunamadı" };
  const id = await ctx.runMutation(internal.hikvisionSync.beginPersonDeletion, { deviceId: device._id, projectId: device.projectId, employeeId, cardNumber, runId });
  let result: { ok: boolean; error?: string };
  try {
    result = device.hikDevIndex ? await deletePersonFromDevice(device.hikDevIndex, cardNumber) : { ok: false, error: "gateway'e kayıtlı değil" };
  } catch { result = { ok: false, error: "Cihaz silme isteği tamamlanamadı" }; }
  if (result.ok) await ctx.runMutation(internal.hikvisionSync.markOpDone, { id });
  else await ctx.runMutation(internal.hikvisionSync.markOpRetried, { id, lastError: result.error ?? "Cihaz silme onayı alınamadı" });
  return { ...result, tracked: true };
}

export async function syncEmployeeDevices(
  ctx: ActionCtx,
  args: {
    employeeId: Id<"employees">;
    runId?: Id<"deviceSyncRuns">;
    targetDeviceIds?: Id<"devices">[];
    allowedProjectIds?: Id<"projects">[];
    /** Kuyruk işçisi tekrar deniyor: hata yeni kayıt açmaz, mevcut kuyruk kaydına yazılır. */
    retrying?: boolean;
  },
  prepared?: { data: EmployeeSyncData; shared: SharedSync },
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const isAllowed = makeProjectGuard(args.allowedProjectIds);
  const data = prepared ? prepared.data : await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
    employeeId: args.employeeId,
  });

  if (!data?.employee.cardNumber) {
    return { synced: 0, failed: 0, errors: [] };
  }
  if (!isAllowed(data.employee.projectId)) {
    return { synced: 0, failed: 0, errors: ["Bu çalışana erişim yetkiniz yok"] };
  }

  if (data.deviceRules.length === 0 && data.previousDevices.length > 0) {
    const result = await ctx.runAction(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
      employeeId: args.employeeId, runId: args.runId, targetDeviceIds: args.targetDeviceIds, allowedProjectIds: args.allowedProjectIds,
      snapshot: { cardNumber: data.employee.cardNumber, projectId: data.employee.projectId, devices: data.previousDevices },
    });
    return { synced: result.removed, failed: result.failed, errors: result.errors };
  }
  // Pasif çalışan cihazlardan silinmeli — cihazda kalırsa erişim 24/7 geçerli kalır
  // (Valid.enable cihazda true olarak yazılıydı). isActive: false olunca delete tetiklenir.
  if (data.employee.isActive === false) {
    if (args.runId) {
      const result = await ctx.runAction(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
        employeeId: args.employeeId, allowedProjectIds: args.allowedProjectIds,
        runId: args.runId, targetDeviceIds: args.targetDeviceIds,
      });
      return { synced: result.removed, failed: result.failed, errors: result.errors };
    }
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
      employeeId: args.employeeId,
      allowedProjectIds: args.allowedProjectIds,
      runId: args.runId,
      targetDeviceIds: args.targetDeviceIds,
    });
    return { synced: 0, failed: 0, errors: [] };
  }

  const { employee, deviceRules } = data;
  const errors: string[] = [];
  type RuleScope = Pick<typeof deviceRules[number], "rule" | "doorNos">;
  type Task = { kind: "skip" | "sync"; device: typeof deviceRules[number]["device"]; rules: RuleScope[]; reason?: string };
  const byDevice = new Map<string, Task>();
  const tasks: Task[] = [];
  // Non-Hikvision cihazlar (QR, vs.) bu pipeline'a hiç girmez — silent skip.
  const hikRules = deviceRules.filter((dr) => dr.device.brand === "hikvision" && (!args.targetDeviceIds || args.targetDeviceIds.includes(dr.device._id)));
  for (const { device, rule, doorNos } of hikRules) {
    if (!isAllowed(device.projectId)) {
      tasks.push({ kind: "skip", device, rules: [{ rule, doorNos }], reason: "erişim yetkiniz yok" });
      continue;
    }
    const key = bridgeDedupeKey(device);
    if (!key) {
      tasks.push({ kind: "skip", device, rules: [{ rule, doorNos }], reason: "gateway'e kayıtlı değil" });
      continue;
    }
    const previous = byDevice.get(key);
    if (previous) {
      previous.rules.push({ rule, doorNos });
    } else {
      const task: Task = { kind: "sync", device, rules: [{ rule, doorNos }] };
      byDevice.set(key, task);
      tasks.push(task);
    }
  }

  // Eksik hikWeekPlanNo'ları topluca ata (action içinde DB write yok, mutation gerekli).
  const rulesNeedingNo = Array.from(
    new Set(
      tasks
        .filter((t) => t.kind === "sync")
        .flatMap(t => t.rules.filter(({ rule }) => !rule.hikWeekPlanNo).map(({ rule }) => rule._id)),
    ),
  );
  const newlyAssigned = new Map<Id<"accessRules">, number>();
  for (const ruleId of rulesNeedingNo) {
    let assignment = prepared?.shared.numbers.get(ruleId);
    if (!assignment) {
      assignment = ctx.runMutation(internal.hikvisionSync.assignWeekPlanNo, { accessRuleId: ruleId });
      prepared?.shared.numbers.set(ruleId, assignment);
    }
    newlyAssigned.set(ruleId, await assignment);
  }
  const resolveWeekPlanNo = (rule: { _id: Id<"accessRules">; hikWeekPlanNo?: number }) =>
    rule.hikWeekPlanNo ?? newlyAssigned.get(rule._id);

  const deviceWarnings = new Map<Id<"devices">, string>();
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

      const scopes: { planTemplateNo: number; doorNos?: number[] }[] = [];
      for (const { rule, doorNos } of t.rules) {
        const planNo = resolveWeekPlanNo(rule);
        if (!planNo) return { ok: false, device: t.device, operation: "addPerson" as const, error: "Kuralın hikWeekPlanNo'su atanamadı" };
        scopes.push({ planTemplateNo: planNo, doorNos });
      }
      const { doorPlans, warnings } = buildDoorPlans(doorCountFor(t.device), scopes);
      for (const warning of warnings) {
        console.warn(`[hik-sync] ${t.device.name}: ${warning}`);
        errors.push(`${t.device.name}: ${warning}`);
      }
      if (warnings.length && doorPlans.length) deviceWarnings.set(t.device._id, warnings.join("; "));
      const multipleBridgePlans = isLocalBridgeDevice(t.device) && new Set(doorPlans.flatMap(p => p.planTemplateNos)).size !== 1;
      if (!doorPlans.length || multipleBridgePlans) {
        const deletion = await removeScopedPerson(ctx, t.device, args.employeeId, employee.cardNumber, args.runId);
        const reason = !doorPlans.length
          ? "Kapsanan kapı yok"
          : "Windows köprüsü kapı başına çoklu planı henüz desteklemiyor";
        return { ok: false, device: t.device, grantRemoved: deletion.ok && !deletion.queued && !deletion.superseded, operation: deletion.ok ? "addPerson" as const : "deletePerson" as const,
          error: deletion.ok
            ? (!doorPlans.length ? `${reason}, kişi cihazdan kaldırıldı` : reason)
            : `${reason}; kişi kaldırılamadı: ${deletion.error ?? "Bilinmeyen hata"}` };
      }
      for (const { rule } of t.rules) {
        const planNo = resolveWeekPlanNo(rule);
        if (!planNo) continue;
        const pushPlan = async () => {
          if (isLocalBridgeDevice(t.device)) {
            await enqueueLocalBridgeOp(ctx, t.device, "syncWeekPlan", {
              accessRuleId: rule._id, weekPlanNo: planNo,
              templateName: rule.name ?? `Rule ${planNo}`, schedule: defaultRuleSchedule(rule, rule.scheduleTemplate ?? null),
            }, args.runId);
            return { ok: true };
          }
          if (!t.device.hikDevIndex) return { ok: false, error: "gateway'e kayıtlı değil" };
          const wp = await setWeekPlanOnDevice(t.device.hikDevIndex, planNo, defaultRuleSchedule(rule, rule.scheduleTemplate ?? null));
          if (!wp.ok) return wp;
          return await setPlanTemplate(t.device.hikDevIndex, planNo, { weekPlanNo: planNo, templateName: rule.name ?? `Rule ${planNo}` });
        };
        const key = `${bridgeDedupeKey(t.device)}:${rule._id}`;
        let plan = prepared?.shared.plans.get(key);
        if (!plan) {
          plan = pushPlan();
          prepared?.shared.plans.set(key, plan);
        }
        const result = await plan;
        if (!result.ok) return { ok: false, device: t.device, operation: "syncWeekPlan" as const, error: result.error ?? "Hafta planı gönderilemedi" };
      }
      if (isLocalBridgeDevice(t.device)) {
        await enqueueLocalBridgeOp(ctx, t.device, "addPerson", {
          ruleIds: t.rules.map(entry => entry.rule._id), employeeId: args.employeeId, employeeNo: employee.cardNumber,
          cardNumber: employee.cardNumber, name: `${employee.firstName} ${employee.lastName}`,
          planTemplateNo: doorPlans[0]?.planTemplateNos[0], doorCount: doorCountFor(t.device),
          doorRights: doorPlans.map(p => p.doorNo),
          beginTime: hikValidBeginFromAccessStart(employee.accessStartsAt, Date.now()),
          endTime: hikValidEndFromAccessEnd(accessEndsAtMs(employee)),
        }, args.runId);
        return { ok: true as const, device: t.device };
      }
      if (!t.device.hikDevIndex) return { ok: false, device: t.device, operation: "addPerson" as const, error: "gateway'e kayıtlı değil" };
      const personResult = await upsertPersonToDevice(t.device.hikDevIndex, {
        employeeNo: employee.cardNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        doorPlans,
        beginTime: hikValidBeginFromAccessStart(employee.accessStartsAt, Date.now()),
        endTime: hikValidEndFromAccessEnd(accessEndsAtMs(employee)),
      });
      if (!personResult.ok) {
        return {
          ok: false,
          device: t.device,
          operation: "addPerson" as const,
          error: `${t.device.name} (person): ${personResult.error ?? "?"}`,
        };
      }
      const cardResult = await addCardToDevice(t.device.hikDevIndex, {
        employeeNo: employee.cardNumber,
        cardNo: employee.cardNumber,
        cardType: "normalCard",
      });
      if (cardResult.ok || cardResult.alreadyExists) {
        try {
          await ctx.runMutation(internal.hikvisionSync.supersedePersonDeletions, { deviceId: t.device._id, cardNumber: employee.cardNumber });
        } catch { /* Claim/cron still protect deletions; cleanup must not block card delivery. */ }
      }
      // alreadyExists hata değil (idempotent); diğer hata varsa warn.
      if (!cardResult.ok && !cardResult.alreadyExists) {
        console.warn(
          `[hik-sync] kart eklerken uyarı (${t.device.name}): ${cardResult.error}`,
        );
      }
      if (args.runId && !cardResult.ok && !cardResult.alreadyExists) return { ok: false, device: t.device, operation: "addCard" as const, error: cardResult.error ?? "Kart gönderilemedi" };
      if (data.hasFingerprintTemplates && t.device.hikTransport === "gateway" && (cardResult.ok || cardResult.alreadyExists)) {
        // Scheduling failures never affect the primary person/card synchronization.
        try {
          await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices, { employeeId: args.employeeId, deviceIds: [t.device._id] });
        } catch { /* Template replay is independently retryable. */ }
      }
      return { ok: true as const, device: t.device, grantError: !cardResult.ok && !cardResult.alreadyExists ? cardResult.error ?? "Kart gönderilemedi" : undefined };
    }),
  );

  let synced = 0;
  let failed = 0;
  const failureWrites: Promise<unknown>[] = [];
  const successDeviceIds: Id<"devices">[] = [];
  for (const r of results) {
    if (r.ok) {
      synced++;
      const warning = deviceWarnings.get(r.device._id);
      if (warning && args.retrying) errors.push(warning);
      else if (warning) {
        failureWrites.push(ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: r.device._id, projectId: r.device.projectId, operation: "addPerson",
          lastError: warning, payload: { employeeId: args.employeeId },
        }));
      } else {
        if (prepared) {
          const ids = prepared.shared.successes.get(r.device._id) ?? [];
          ids.push(args.employeeId);
          prepared.shared.successes.set(r.device._id, ids);
        } else successDeviceIds.push(r.device._id);
      }
      continue;
    }
    failed++;
    if (r.error) errors.push(r.error);
    if (!args.retrying) failureWrites.push(
      ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
        deviceId: r.device._id,
        projectId: r.device.projectId,
        operation: r.operation,
        lastError: r.error,
        payload: { employeeId: args.employeeId, ...(r.operation === "deletePerson" ? { cardNumber: employee.cardNumber, employeeNo: employee.cardNumber } : {}) },
      }),
    );
  }
  await Promise.all([
    ...failureWrites,
    ...resolveSuccesses(ctx, successDeviceIds, ["addPerson", "updatePerson", "addCard"], {
      employeeId: args.employeeId,
    }),
  ]);
  // HTTP tasks dedupe physical gateways, while grant attribution stays per device.
  const resultByDeviceKey = new Map(results.map(result => [bridgeDedupeKey(result.device) ?? result.device._id, result]));
  const rulesByDevice = new Map<Id<"devices">, Id<"accessRules">[]>();
  const grantDevices = new Map(hikRules.map(({ device }) => [device._id, device]));
  for (const { device, rule } of hikRules) rulesByDevice.set(device._id, [...rulesByDevice.get(device._id) ?? [], rule._id]);
  const grantResults: GrantResult[] = [...grantDevices.values()].flatMap(device => {
    const result = resultByDeviceKey.get(bridgeDedupeKey(device) ?? device._id);
    if (!result || isLocalBridgeDevice(device) || !device.projectId || !isAllowed(device.projectId)) return [];
    return [{ projectId: device.projectId, employeeId: args.employeeId, deviceId: device._id,
      state: result.grantRemoved ? "removed" as const : result.ok && !result.grantError ? "effective" as const : "failed" as const,
      ruleIds: rulesByDevice.get(device._id) ?? [],
      lastRunId: args.runId, lastError: result.grantRemoved ? undefined : result.grantError ?? (result.ok ? undefined : result.error) }];
  });
  if (prepared) prepared.shared.grantResults.push(...grantResults);
  else if (grantResults.length) await ctx.runMutation(internal.accessGrantStatus.recordGrantResults, { results: grantResults });
  return { synced, failed, errors };
}

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

export async function syncWeekPlanDevices(
  ctx: ActionCtx,
  args: {
    accessRuleId: Id<"accessRules">;
    targetEmployeeIds?: Id<"employees">[];
    runId?: Id<"deviceSyncRuns">;
    targetDeviceIds?: Id<"devices">[];
    allowedProjectIds?: Id<"projects">[];
  },
): Promise<{
  synced: number;
  failed: number;
  errors: string[];
  employeesSynced: number;
}> {
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
    weekPlanNo = await ctx.runMutation(internal.hikvisionSync.assignWeekPlanNo, {
      accessRuleId: args.accessRuleId,
    });
  }

  const schedule = defaultRuleSchedule(rule, rule.scheduleTemplate ?? null);

  const errors: string[] = [];
  const skippedDevices: { device: typeof devices[number]; reason: string }[] = [];
  const hikDevices = filterHikvisionDevices(devices).filter(d =>
    !args.targetDeviceIds || args.targetDeviceIds.includes(d._id));
  const allowedDevices = hikDevices.filter((d) => {
    if (!isAllowed(d.projectId)) {
      skippedDevices.push({ device: d, reason: "bu cihaza erişim yetkiniz yok" });
      return false;
    }
    const key = bridgeDedupeKey(d);
    if (!key) {
      skippedDevices.push({ device: d, reason: "gateway'e kayıtlı değil" });
      return false;
    }
    return true;
  });
  const selectedEmployees = employees.filter(employee => !args.targetEmployeeIds || args.targetEmployeeIds.includes(employee._id));
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
      if (isLocalBridgeDevice(d)) {
        await enqueueLocalBridgeOp(ctx, d, "syncWeekPlan", {
          accessRuleId: args.accessRuleId,
          weekPlanNo,
          templateName: rule.name ?? `Rule ${weekPlanNo}`,
          schedule,
        }, args.runId);
        return { ok: true as const, device: d };
      }
      if (!d.hikDevIndex) {
        return { ok: false as const, error: "gateway'e kayıtlı değil", device: d };
      }
      const wp = await setWeekPlanOnDevice(d.hikDevIndex, weekPlanNo, schedule);
      if (!wp.ok) return { ...wp, device: d };
      // Aynı numarayı template no olarak da kullan — basitlik için 1-1 eşleme.
      const tpl = await setPlanTemplate(d.hikDevIndex, weekPlanNo, {
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

  // Recompute every employee's complete rule union; never overwrite with only
  // the rule whose week plan happened to change.
  const shared: SharedSync = { plans: new Map(), numbers: new Map(), successes: new Map(), grantResults: [] };
  for (const result of planResults) {
    shared.plans.set(`${bridgeDedupeKey(result.device)}:${rule._id}`, Promise.resolve(result));
  }
  const targets = selectedEmployees;
  let employeesSynced = 0;
  // Bound HTTP concurrency and fetch complete employee rule unions in batches.
  for (let offset = 0; offset < targets.length; offset += 20) {
    const batch = targets.slice(offset, offset + 20);
    const employeeData = await ctx.runQuery(internal.hikvisionSync.getEmployeesWithDevices, { employeeIds: batch.map(emp => emp._id) });
    const results = await Promise.all(batch.map((emp, index) => syncEmployeeDevices(ctx, {
      employeeId: emp._id, runId: args.runId,
      targetDeviceIds: allowedDevices.map(d => d._id), allowedProjectIds: args.allowedProjectIds,
    }, { data: employeeData[index] ?? null, shared })));
    for (const result of results) {
      employeesSynced += result.synced;
      failed += result.failed;
      errors.push(...result.errors);
    }
  }
  await Promise.all(Array.from(shared.successes, ([deviceId, employeeIds]) =>
    ctx.runMutation(internal.hikvisionSync.resolveTargetFailures, {
      deviceId, employeeIds, operations: ["addPerson", "updatePerson", "addCard"],
    }),
  ));

  // Large rules deliberately exceed the usual <=1 grant mutation/action budget.
  // Device delivery must not be blocked by status volume: ceil(n / 500) bounded writes.
  for (let offset = 0; offset < shared.grantResults.length; offset += 500) {
    await ctx.runMutation(internal.accessGrantStatus.recordGrantResults, { results: shared.grantResults.slice(offset, offset + 500) });
  }
  return { synced, failed, errors, employeesSynced };
}
