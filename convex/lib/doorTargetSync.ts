import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { bounded, upsertGrantStatus } from "./grantStatus";
import { summarizeRun } from "./deviceSyncRun";
import { assertDeviceDoorTargets } from "./doorTarget";
import { allocateIdePermissionNos, buildIdePermissionRecord, enqueueIdeOpInTransaction, ideRuleSegments, ruleIoIdsForPanel } from "../ideSync";

export async function snapshotDoorTarget(ctx: MutationCtx, door: Doc<"doors">, nextDeviceId?: Id<"devices">) {
  const links = bounded(await ctx.db.query("groupDoors").withIndex("by_door", q => q.eq("doorId", door._id)).take(101), 100);
  const ruleIds = new Set(links.map(link => link.groupId));
  const ruleDeviceIds = new Map<Id<"accessRules">, Set<Id<"devices">>>();
  for (const link of links) if (door.deviceId) ruleDeviceIds.set(link.groupId, new Set([door.deviceId]));
  // IDE blanket rules derive their actuator list from doors too, including on
  // the destination panel. Capture those before moving the physical target.
  for (const deviceId of new Set([door.deviceId, nextDeviceId])) {
    if (!deviceId) continue;
    const deviceLinks = bounded(await ctx.db.query("groupDevices").withIndex("by_project_device", q => q.eq("projectId", door.projectId).eq("deviceId", deviceId)).take(101), 100);
    for (const link of deviceLinks) {
      ruleIds.add(link.groupId);
      const deviceIds = ruleDeviceIds.get(link.groupId) ?? new Set<Id<"devices">>();
      deviceIds.add(deviceId);
      ruleDeviceIds.set(link.groupId, deviceIds);
    }
  }
  if (ruleIds.size > 100) throw new ConvexError("Kapı kural sınırı aşıldı; kayıt yapılmadı.");
  const rules = [];
  let memberCount = 0;
  for (const ruleId of ruleIds) {
    const rule = await ctx.db.get(ruleId);
    if (!rule || rule.projectId !== door.projectId) continue;
    // Device-wide rules only need their shared plan refreshed; do not load or
    // count their members in the interactive door mutation.
    if (!links.some(link => link.groupId === ruleId)) {
      const hasMembers = await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).first() !== null;
      rules.push({ rule, employees: [], blanket: true, hasMembers, beforeDeviceIds: [...ruleDeviceIds.get(ruleId) ?? []] });
      continue;
    }
    const members = bounded(await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).take(501), 500);
    memberCount += members.length;
    if (memberCount > 200) throw new ConvexError("Kapı yetkisi güncelleme sınırı aşıldı (200 kişi); kayıt yapılmadı.");
    const employees = (await Promise.all(members.map(member => ctx.db.get(member.employeeId))))
      .filter((employee): employee is NonNullable<typeof employee> => employee !== null)
      .filter(employee => employee.projectId === door.projectId);
    rules.push({ rule, employees, blanket: false, hasMembers: employees.some(employee => employee.isActive !== false), beforeDeviceIds: [...ruleDeviceIds.get(ruleId) ?? []] });
  }
  if (rules.length) for (const deviceId of new Set([door.deviceId, nextDeviceId])) {
    if (!deviceId) continue;
    const device = await ctx.db.get(deviceId);
    if (device?.brand === "hikvision" && device.hikTransport === "localBridge") {
      throw new ConvexError("Bu kapı Windows köprüsüyle bağlı bir cihazda; kapı numarası veya cihaz değişikliği şu an güvenli şekilde uygulanamıyor. Önce kapının kurallarını kaldırın.");
    }
  }
  return { door, links, rules };
}

/** Retarget explicit door selections atomically; do not turn the former panel into a blanket grant. */
export async function syncChangedDoorTarget(ctx: MutationCtx, before: Awaited<ReturnType<typeof snapshotDoorTarget>>, after: Doc<"doors">, startedBy: Id<"users">) {
  const projectId = after.projectId;
  if (!projectId || !before.rules.length) return;
  const now = Date.now();
  if (before.door.deviceId !== after.deviceId) {
    for (const link of before.links) await ctx.db.patch(link._id, { deviceId: after.deviceId });
    for (const { rule } of before.rules) {
      if (!before.links.some(link => link.groupId === rule._id)) continue;
      const selections = bounded(await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(201), 200);
      const doors = await Promise.all(selections.map(link => ctx.db.get(link.doorId)));
      const deviceLinks = bounded(await ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", rule._id)).take(201), 200);
      if (!doors.some(door => door?.deviceId === before.door.deviceId)) {
        for (const link of deviceLinks.filter(link => link.deviceId === before.door.deviceId)) await ctx.db.delete(link._id);
      }
      if (after.deviceId && !deviceLinks.some(link => link.deviceId === after.deviceId)) {
        await ctx.db.insert("groupDevices", { projectId, groupId: rule._id, deviceId: after.deviceId, createdAt: new Date(now).toISOString() });
      }
    }
  }
  const devices = (await Promise.all([...new Set([before.door.deviceId, after.deviceId].filter((id): id is Id<"devices"> => id !== undefined))].map(id => ctx.db.get(id))))
    .filter((device): device is NonNullable<typeof device> => device !== null)
    .filter(device => device.projectId === projectId && (device.brand === "hikvision" || device.brand === "ide_smart"));
  for (const device of devices) await assertDeviceDoorTargets(ctx, device);
  for (const { rule, employees, blanket, hasMembers, beforeDeviceIds } of before.rules) {
    await ctx.db.patch(rule._id, { updatedAt: new Date(now).toISOString() });
    const runId = await ctx.db.insert("deviceSyncRuns", { projectId, ruleId: rule._id, kind: "rule_sync", startedBy, startedAt: now, status: "running", dispatchFinished: true, counts: summarizeRun([], false).counts });
    const ruleDeviceIds = new Set(beforeDeviceIds);
    if (after.deviceId && before.links.some(link => link.groupId === rule._id)) ruleDeviceIds.add(after.deviceId);
    for (const device of devices.filter(device => ruleDeviceIds.has(device._id))) {
      const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other", status: "queued", dispatchFinished: true, updatedAt: now });
      if (blanket && device.brand === "hikvision") {
        await ctx.db.patch(targetId, { dispatchFinished: false });
        await ctx.scheduler.runAfter(0, internal.doors.syncDoorBlanketRule, { ruleId: rule._id, deviceId: device._id, targetId, runId });
        continue;
      }
      for (const employee of employees) {
        await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "pending", lastRunId: runId });
        if (device.brand !== "hikvision") continue;
        // Durable queue evidence exists before the first network call. Retrying this
        // marker must always use the rights-only path, never the person-removal path.
        const operationId = await ctx.db.insert("hikPendingOperations", {
          projectId, deviceId: device._id, runId, operation: "updatePerson", status: "processing", processingStartedAt: now, attemptCount: 0, createdAt: now, nextRetryAt: now,
          lastError: "Kapı yetkisi gönderimi bekleniyor",
          payload: { rightsOnly: true, employeeId: employee._id, cardNumber: employee.cardNumber, doorId: after._id,
            previousDeviceId: before.door.deviceId, previousDoorNo: before.door.hikDoorNo, previousIoId: before.door.ioId,
            nextDeviceId: after.deviceId, nextDoorNo: after.hikDoorNo, nextIoId: after.ioId },
        });
        await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "pending", lastRunId: runId, lastOperationId: operationId });
        await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncDoorRightsOperation, { operationId });
      }
      if (device.brand === "ide_smart") {
        // Permission records carry door rights independently of the panel's user record.
        // Empty io removes this rule's old actuator access without deleting anyone.
        const currentRule = await ctx.db.get(rule._id);
        if (!currentRule) continue;
        const segments = ideRuleSegments(currentRule);
        const plan = await allocateIdePermissionNos(ctx, currentRule, segments.length, runId);
        const remaining = bounded(await ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", rule._id)).take(201), 200);
        const ioIds = remaining.some(link => link.deviceId === device._id) || after.deviceId === device._id
          ? await ruleIoIdsForPanel(ctx, { ruleId: rule._id, deviceId: device._id }) : [];
        for (const [index, schedule] of segments.entries()) {
          const no = plan.nos[index];
          if (no === undefined) continue;
          await enqueueIdeOpInTransaction(ctx, { deviceId: device._id, projectId, runId, opType: "upsertPermission", payload: { mode: "create", permissionRecord: { ...buildIdePermissionRecord(no, ioIds, {}), schedule } } });
        }
        const employeeIds = employees.filter(employee => employee.isActive !== false).map(employee => employee._id);
        if (blanket && ioIds.length && hasMembers) {
          await ctx.db.patch(targetId, { dispatchFinished: false });
          await ctx.scheduler.runAfter(0, internal.doors.syncDoorBlanketRule, { ruleId: rule._id, deviceId: device._id, targetId, runId });
        } else if (ioIds.length && employeeIds.length) {
          await ctx.db.patch(targetId, { dispatchFinished: false });
          await ctx.scheduler.runAfter(0, internal.doors.syncDoorIdeTarget, { employeeIds, deviceId: device._id, targetId, runId });
        } else {
          await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId, skipped: "Panelde kalan kapı hakkı yok" });
          for (const employee of employees) await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "removed", lastRunId: runId });
        }
      }
      if (!employees.length && device.brand === "hikvision") await ctx.db.patch(targetId, { status: "skipped", reason: "Etkilenen kişi yok" });
    }
    await ctx.scheduler.runAfter(5000, internal.deviceSyncRuns.refreshSummary, { runId });
    await ctx.scheduler.runAfter(600000, internal.deviceSyncRuns.expireRun, { runId });
  }
}
