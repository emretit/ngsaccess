import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { writeAudit } from "./lib/audit";
import { isBiometricEnabled } from "./lib/privacySettings";
import { DESTRUCTION_BATCH_SIZE, MAX_PENDING_DEVICE_OPS, DEVICE_OFFLINE_MS, deviceCheckDelay, DEVICE_TARGET_LIMIT, DEVICE_WAIT_MS, PREVIEW_LIMIT, destructionReport, destructionStateSchema, initialDestructionState, summarizePreview, validateDestructionInput, type DestructionState, itemValidator } from "./lib/biometricDestruction";

const kind = v.union(v.literal("face"), v.literal("fingerprint"));
const STATE_TABLE = "biometricDestructionRun";
const WATCHDOG_MS = 10 * 60 * 1000;

async function requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const allowed = await getProjectIdsForUser(ctx);
  if (!allowed.includes(projectId)) throw new ConvexError({ code: "FORBIDDEN", message: "Bu projeye erişim yetkiniz yok." });
  const project = await ctx.db.get(projectId);
  if (!project) throw new ConvexError({ code: "NOT_FOUND", message: "Proje bulunamadı." });
  return project;
}

async function latestRun(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const rows = await ctx.db.query("auditLog").withIndex("by_project_table_timestamp", q => q.eq("projectId", projectId).eq("targetTable", STATE_TABLE)).order("desc").take(1);
  return rows[0] ?? null;
}
async function readRun(ctx: QueryCtx | MutationCtx, runId: Id<"auditLog">) {
  const row = await ctx.db.get(runId);
  if (!row || row.targetTable !== STATE_TABLE || !row.projectId) return null;
  const parsed = destructionStateSchema.safeParse(row.newValue as unknown);
  return parsed.success ? { row, projectId: row.projectId, state: parsed.data } : null;
}
async function saveState(ctx: MutationCtx, row: Doc<"auditLog">, state: DestructionState, note: string) {
  if (state.status === "failed") {
    state.deviceUnconfirmed += state.pendingOpIds.length;
    state.pendingOpIds = [];
    state.pendingDeviceChecks = 0;
  }
  await ctx.db.patch(row._id, { newValue: state });
  if (state.status !== "completed" && state.status !== "failed") return;
  await writeAudit(ctx, { user: row.userId ? await ctx.db.get(row.userId) : null, projectId: row.projectId, action: "update", targetTable: "biometricDestruction", targetId: row._id, newValue: { ...destructionReport(row.projectId ?? "", state), baslatan: row.userName ?? null, userId: row.userId ?? null }, note });
}
async function settleIfReady(ctx: MutationCtx, row: Doc<"auditLog">, state: DestructionState) {
  if (state.status === "waitingDevices" && state.pendingDeviceChecks === 0) {
    state.status = "completed";
    state.finishedAt = Date.now();
  }
  await saveState(ctx, row, state, state.status === "completed" ? "Biyometrik imha tutanağı" : "Biyometrik imha ilerlemesi");
}

export const previewBiometricDestruction = adminQuery({
  args: { projectId: v.id("projects"), kinds: v.array(kind) },
  handler: async (ctx, args) => {
    const project = await requireProject(ctx, args.projectId);
    if (!args.kinds.length) throw new ConvexError({ code: "INVALID_KINDS", message: "En az bir biyometrik tür seçin." });
    const faces = args.kinds.includes("face") ? await ctx.db.query("employeeFaces").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(PREVIEW_LIMIT + 1) : [];
    // Fingerprint documents may be large; cap bytes as well as row count via pagination.
    const fingerprints = args.kinds.includes("fingerprint") ? await ctx.db.query("employeeFingerprints").withIndex("by_project", q => q.eq("projectId", args.projectId)).paginate({ numItems: PREVIEW_LIMIT + 1, cursor: null, maximumBytesRead: 2_000_000 }) : null;
    // Bounded legacy sample; full erasure traverses every employee in small pages.
    const employees = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(51);
    const legacyFaces: Doc<"employeeFaces">[] = [];
    const legacyFingers: Doc<"employeeFingerprints">[] = [];
    let legacyCapped = employees.length > 50;
    for (const employee of employees.slice(0, 50)) {
      const ef = args.kinds.includes("face") ? await ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", employee._id)).take(2) : [];
      const ep = args.kinds.includes("fingerprint") ? await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employee._id)).take(11) : [];
      legacyCapped ||= ef.length === 2 || ep.length === 11;
      legacyFaces.push(...ef.filter(template => template.projectId === undefined));
      legacyFingers.push(...ep.filter(template => template.projectId === undefined));
    }
    const summary = summarizePreview([...faces, ...legacyFaces], [...(fingerprints?.page ?? []), ...legacyFingers], args.kinds);
    return { ...summary, projectlessTemplateCount: legacyFaces.length + legacyFingers.length, capped: summary.capped || legacyCapped || (fingerprints !== null && !fingerprints.isDone), projectName: project.name, biometricEnabled: await isBiometricEnabled(ctx, args.projectId) };
  },
});

export const startBiometricDestruction = adminMutation({
  args: { projectId: v.id("projects"), kinds: v.array(kind), confirmText: v.string(), reason: v.string() },
  handler: async (ctx, args): Promise<Id<"auditLog">> => {
    const project = await requireProject(ctx, args.projectId);
    const error = validateDestructionInput(project.name, args.confirmText, args.reason, args.kinds);
    if (error) throw new ConvexError({ code: "INVALID_CONFIRMATION", message: error });
    const latest = await latestRun(ctx, args.projectId);
    if (latest) {
      const previous = destructionStateSchema.safeParse(latest.newValue as unknown);
      if (!previous.success || ["running", "waitingDevices"].includes(previous.data.status)) throw new ConvexError({ code: "DESTRUCTION_ACTIVE", message: "Bu projede devam eden bir imha işlemi var." });
    }
    if (await isBiometricEnabled(ctx, args.projectId)) throw new ConvexError({ code: "BIOMETRIC_MODULE_ACTIVE", message: "Önce biyometri modülünü kapatın." });
    const state = initialDestructionState(project.name, args.kinds, args.reason, Date.now());
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "create", targetTable: STATE_TABLE, targetId: args.projectId, newValue: state, note: "Biyometrik imha çalışma durumu" });
    const run = await latestRun(ctx, args.projectId);
    if (!run) throw new Error("İmha kaydı oluşturulamadı.");
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "create", targetTable: "biometricDestruction", targetId: run._id, newValue: destructionReport(args.projectId, state), note: "Biyometrik imha başladı" });
    await ctx.scheduler.runAfter(0, internal.biometricDestruction.prepareBatch, { runId: run._id });
    await ctx.scheduler.runAfter(WATCHDOG_MS, internal.biometricDestruction.watchRun, { runId: run._id });
    return run._id;
  },
});

export const getDestructionRun = adminQuery({
  args: { projectId: v.id("projects"), runId: v.optional(v.id("auditLog")) },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const row = args.runId ? await ctx.db.get(args.runId) : await latestRun(ctx, args.projectId);
    if (!row || row.projectId !== args.projectId || row.targetTable !== STATE_TABLE) return null;
    const parsed = destructionStateSchema.safeParse(row.newValue as unknown);
    return parsed.success ? { runId: row._id, userName: row.userName ?? "Yönetici", ...parsed.data, report: destructionReport(args.projectId, parsed.data) } : null;
  },
});

export const prepareBatch = internalMutation({
  args: { runId: v.id("auditLog") },
  handler: async (ctx, { runId }): Promise<void> => {
    const run = await readRun(ctx, runId);
    if (!run || run.state.status !== "running") return;
    const { row, state, projectId } = run;
    state.heartbeatAt = Date.now();
    const continueScan = async () => {
      await saveState(ctx, row, state, "Şablon taraması sürüyor");
      await ctx.scheduler.runAfter(0, internal.biometricDestruction.prepareBatch, { runId });
    };
    const finishKind = async () => {
      if (state.phase === "face" && state.kinds.includes("fingerprint")) {
        state.phase = "fingerprint"; state.scan = "project"; state.cursor = null;
        state.employeeCursor = null; state.legacyEmployeeId = null;
        await continueScan();
      } else {
        state.status = "waitingDevices";
        if (state.pendingOpIds.length) {
          state.pendingDeviceChecks = 1;
          state.deviceCheckDeadline = Date.now() + DEVICE_WAIT_MS;
          await ctx.scheduler.runAfter(deviceCheckDelay(0), internal.biometricDestruction.checkDeviceOperations, { runId, attempt: 0 });
        }
        await settleIfReady(ctx, row, state);
      }
    };
    if (state.scan === "legacy" && !state.legacyEmployeeId) {
      const employees = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId).lte("_creationTime", state.startedAt)).paginate({ numItems: 1, cursor: state.employeeCursor });
      const employee = employees.page[0];
      if (!employee) { await finishKind(); return; }
      if (state.phase === "fingerprint") {
        // Source-only captures (central save failed) also need device erasure.
        const central = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employee._id)).first();
        if (!central) await ctx.runMutation(internal.fingerprintEnrollment.removeAllForEmployee, { employeeId: employee._id, employeeNo: employee.cardNumber });
      }
      state.employeeCursor = employees.continueCursor;
      state.legacyEmployeeId = employee._id;
      state.cursor = null;
      await continueScan(); return;
    }
    const employeeId = state.legacyEmployeeId as Id<"employees"> | null;
    const page = state.phase === "face"
      ? await (employeeId
        ? ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", employeeId).lte("_creationTime", state.startedAt))
        : ctx.db.query("employeeFaces").withIndex("by_project", q => q.eq("projectId", projectId).lte("_creationTime", state.startedAt)))
        .paginate({ numItems: DESTRUCTION_BATCH_SIZE, cursor: state.cursor })
      : await (employeeId
        ? ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId).lte("_creationTime", state.startedAt))
        : ctx.db.query("employeeFingerprints").withIndex("by_project", q => q.eq("projectId", projectId).lte("_creationTime", state.startedAt)))
        .paginate({ numItems: DESTRUCTION_BATCH_SIZE, cursor: state.cursor });
    const template = page.page[0];
    if (!template) {
      if (state.scan === "project") { state.scan = "legacy"; state.cursor = null; }
      else { state.legacyEmployeeId = null; state.cursor = null; }
      await continueScan(); return;
    }
    state.cursor = page.continueCursor;
    if (state.scan === "legacy") {
      const owner = await ctx.db.get(template.employeeId);
      if (template.projectId !== undefined || owner?.projectId !== projectId) { await continueScan(); return; }
    }
    state.batch += 1;
    state.heartbeatAt = Date.now();
    if (template.addedAt > state.startedAt) {
      state.skippedChanged += 1;
      await saveState(ctx, row, state, "Başlangıçtan sonra değişen şablon atlandı");
      await ctx.scheduler.runAfter(0, internal.biometricDestruction.prepareBatch, { runId });
      return;
    }
    // Freeze all project devices, including devices no longer in the employee's access rules.
    const devices = await ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", projectId)).take(DEVICE_TARGET_LIMIT + 1);
    if (devices.length > DEVICE_TARGET_LIMIT) {
      state.status = "failed"; state.finishedAt = Date.now(); state.error = "Projedeki cihaz sayısı güvenli işlem sınırını (50) aşıyor. Bu partide şablon silinmedi; destek ile iletişime geçin.";
      await saveState(ctx, row, state, state.error); return;
    }
    const employee = await ctx.db.get(template.employeeId);
    const validEmployee = employee?.projectId === projectId && employee.cardNumber ? employee : null;
    const targets = validEmployee ? devices.filter(device => device.brand === "hikvision").map(device => ({ deviceId: device._id, hikDevIndex: device.hikDevIndex, hikTransport: device.hikTransport })) : [];
    const item = {
      kind: state.phase, employeeId: template.employeeId, addedAt: template.addedAt,
      ...( "pictureStorageId" in template ? { faceId: template._id, storageId: template.pictureStorageId } : { fingerprintId: template._id, fingerPrintID: template.fingerPrintID }),
      cardNumber: validEmployee?.cardNumber ?? "", targets, unconfirmed: validEmployee ? 0 : 1,
    };
    await saveState(ctx, row, state, "Cihaz hedefleri silme öncesinde donduruldu");
    await ctx.scheduler.runAfter(0, internal.actions.biometricDestruction.destroyBatch, { runId, batch: state.batch, projectId, item });
  },
});

export const isBatchActive = internalQuery({
  args: { runId: v.id("auditLog"), batch: v.number() },
  handler: async (ctx, args) => {
    const run = await readRun(ctx, args.runId);
    return Boolean(run && run.state.status === "running" && run.state.batch === args.batch);
  },
});

export const createGatewayOperation = internalMutation({
  args: { runId: v.id("auditLog"), batch: v.number(), deviceId: v.id("devices"), hikDevIndex: v.optional(v.string()), employeeId: v.id("employees"), cardNumber: v.string(), kind, fingerPrintID: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Id<"hikPendingOperations"> | null> => {
    const run = await readRun(ctx, args.runId);
    if (!run || run.state.status !== "running" || run.state.batch !== args.batch) return null;
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.projectId !== run.projectId || device.brand !== "hikvision" || device.hikTransport === "localBridge" || device.hikDevIndex !== args.hikDevIndex) return null;
    const opId = await ctx.db.insert("hikPendingOperations", {
      projectId: run.projectId, deviceId: args.deviceId, operation: args.kind === "face" ? "deleteFace" : "deleteFingerprint",
      payload: { employeeId: args.employeeId, cardNumber: args.cardNumber, ...(args.fingerPrintID !== undefined ? { fingerPrintID: args.fingerPrintID } : {}), destructionRunId: args.runId },
      status: "processing", processingStartedAt: Date.now(), attemptCount: 1, createdAt: Date.now(),
    });
    return opId;
  },
});

/** Atomic scope check before the existing bridge enqueue helper writes its operation. */
export const queueBridgeOperation = internalMutation({
  args: { runId: v.id("auditLog"), batch: v.number(), deviceId: v.id("devices"), employeeId: v.id("employees"), cardNumber: v.string(), kind, fingerPrintID: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Id<"hikPendingOperations"> | null> => {
    const run = await readRun(ctx, args.runId);
    const device = await ctx.db.get(args.deviceId);
    if (!run || run.state.status !== "running" || run.state.batch !== args.batch || !device || device.projectId !== run.projectId || device.hikTransport !== "localBridge") return null;
    const opId: Id<"hikPendingOperations"> = await ctx.runMutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
      projectId: run.projectId, deviceId: args.deviceId, operation: args.kind === "face" ? "deleteFace" : "deleteFingerprint",
      payload: { employeeId: args.employeeId, cardNumber: args.cardNumber, ...(args.fingerPrintID !== undefined ? { fingerPrintID: args.fingerPrintID } : {}), destructionRunId: args.runId },
    });
    return opId;
  },
});

export const finishGatewayOperation = internalMutation({
  args: { runId: v.id("auditLog"), opId: v.id("hikPendingOperations"), ok: v.boolean() },
  handler: async (ctx, args) => {
    const run = await readRun(ctx, args.runId);
    const op = await ctx.db.get(args.opId);
    if (!run || !op || op.projectId !== run.projectId) return;
    // Generic gateway retries resolve the current card number instead of our snapshot.
    // Keep failed erasure evidence terminal; do not target a subsequently changed card.
    await ctx.db.patch(args.opId, { status: args.ok ? "done" : "failed", completedAt: Date.now(), attemptCount: args.ok ? op.attemptCount : 5, lastError: args.ok ? undefined : "Biyometrik şablon cihazdan silinemedi." });
  },
});

export const finishBatch = internalMutation({
  args: { runId: v.id("auditLog"), batch: v.number(), item: itemValidator, deviceOperations: v.number(), deviceFailures: v.number(), deviceUnconfirmed: v.number(), queuedOpIds: v.array(v.id("hikPendingOperations")) },
  handler: async (ctx, args): Promise<void> => {
    const run = await readRun(ctx, args.runId);
    if (!run || run.state.status !== "running" || run.state.batch !== args.batch) return;
    const { state, row, projectId } = run;
    const item = args.item;
    // Revision checks preserve replacements made while the action was running.
    if (item.faceId) {
      const face = await ctx.db.get(item.faceId);
      if (face && (face.projectId === projectId || (face.projectId === undefined && (await ctx.db.get(face.employeeId))?.projectId === projectId)) && face.addedAt === item.addedAt && face.pictureStorageId === item.storageId) {
        const profileReferences = await ctx.db.query("employees").withIndex("by_photo_storage", q => q.eq("photoStorageId", face.pictureStorageId)).take(1);
        if (!profileReferences.length && await ctx.db.system.get(face.pictureStorageId)) { await ctx.storage.delete(face.pictureStorageId); state.deletedFiles += 1; }
        await ctx.db.delete(face._id); state.deletedFaces += 1;
      } else if (face) state.skippedChanged += 1;
    }
    if (item.fingerprintId) {
      const fingerprint = await ctx.db.get(item.fingerprintId);
      if (fingerprint && (fingerprint.projectId === projectId || (fingerprint.projectId === undefined && (await ctx.db.get(fingerprint.employeeId))?.projectId === projectId)) && fingerprint.addedAt === item.addedAt) {
        await ctx.runMutation(internal.fingerprintEnrollment.removeAllForEmployee, { employeeId: fingerprint.employeeId, employeeNo: item.cardNumber, fingerNo: fingerprint.fingerPrintID });
        state.deletedFingerprints += 1;
      } else if (fingerprint) state.skippedChanged += 1;
    }
    state.deviceOperations += args.deviceOperations;
    state.deviceFailures += args.deviceFailures;
    state.deviceUnconfirmed += args.deviceUnconfirmed;
    state.heartbeatAt = Date.now();
    // Increment invalidates duplicate action completions before scheduling the next page.
    state.batch += 1;
    // Keep a bounded tail. Overflow is explicitly unconfirmed, never assumed successful.
    const pending = [...state.pendingOpIds, ...args.queuedOpIds];
    state.deviceUnconfirmed += Math.max(0, pending.length - MAX_PENDING_DEVICE_OPS);
    state.pendingOpIds = pending.slice(-MAX_PENDING_DEVICE_OPS);
    state.pendingDeviceChecks = state.pendingOpIds.length ? 1 : 0;
    await saveState(ctx, row, state, "Convex biyometrik şablon partisi silindi");
    await ctx.scheduler.runAfter(0, internal.biometricDestruction.prepareBatch, { runId: args.runId });
  },
});

export const checkDeviceOperations = internalMutation({
  // Optional legacy arguments keep scheduled invocations compatible; they cannot spawn chains.
  args: { runId: v.id("auditLog"), attempt: v.optional(v.number()), checkId: v.optional(v.id("auditLog")), opIds: v.optional(v.array(v.id("hikPendingOperations"))), deadline: v.optional(v.number()) },
  handler: async (ctx, args): Promise<void> => {
    const run = await readRun(ctx, args.runId);
    if (!run || run.state.status !== "waitingDevices" || args.checkId || (args.attempt ?? 0) !== run.state.deviceCheckAttempt) return;
    const { state, projectId } = run;
    const now = Date.now();
    const bridges = await ctx.db.query("hikBridges").withIndex("by_project", q => q.eq("projectId", projectId)).take(50);
    const bridgeOnline = bridges.some(bridge => bridge.lastSeenAt !== undefined && now - bridge.lastSeenAt < DEVICE_OFFLINE_MS);
    const pending: string[] = [];
    const deviceCache = new Map<string, Doc<"devices"> | null>();
    for (const id of state.pendingOpIds) {
      const op = await ctx.db.get(id as Id<"hikPendingOperations">);
      if (!op || op.projectId !== projectId) { state.deviceUnconfirmed += 1; continue; }
      if (op.status === "failed") { state.deviceFailures += 1; continue; }
      if (op.status === "done") continue;
      if (!deviceCache.has(op.deviceId)) deviceCache.set(op.deviceId, await ctx.db.get(op.deviceId));
      const device = deviceCache.get(op.deviceId);
      const offline = !device || device.projectId !== projectId || (device.hikTransport === "localBridge" && (!bridgeOnline || device.hikLastSeenAt === undefined || now - device.hikLastSeenAt >= DEVICE_OFFLINE_MS));
      if (offline || now >= (state.deviceCheckDeadline ?? now)) state.deviceUnconfirmed += 1;
      else pending.push(id);
    }
    state.pendingOpIds = pending;
    state.pendingDeviceChecks = pending.length ? 1 : 0;
    if (pending.length) {
      state.deviceCheckAttempt += 1;
      await ctx.scheduler.runAfter(deviceCheckDelay(state.deviceCheckAttempt), internal.biometricDestruction.checkDeviceOperations, { runId: args.runId, attempt: state.deviceCheckAttempt });
    }
    await settleIfReady(ctx, run.row, state);
  },
});

export const watchRun = internalMutation({
  args: { runId: v.id("auditLog") },
  handler: async (ctx, args): Promise<void> => {
    const run = await readRun(ctx, args.runId);
    if (!run || run.state.status !== "running") return;
    if (Date.now() - run.state.heartbeatAt < WATCHDOG_MS) {
      await ctx.scheduler.runAfter(WATCHDOG_MS, internal.biometricDestruction.watchRun, args); return;
    }
    run.state.status = "failed"; run.state.finishedAt = Date.now();
    run.state.error = "İmha işlemi kesildi. Silinen kayıtlar geri alınmadı; kalan şablonları yeniden sayın. Son cihaz partisinin sonucu doğrulanamadı.";
    run.state.deviceUnconfirmed += 1;
    await saveState(ctx, run.row, run.state, run.state.error);
  },
});
