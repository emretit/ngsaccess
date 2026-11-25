import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { authedAction, authedMutation, authedQuery } from "./lib/customFunctions";
import { requireEmployeeAccess } from "./lib/auth";
import { requirePermission } from "./lib/permissions";
import { assertBiometricAllowed } from "./lib/biometricGate";
import { employeeDevices } from "./fingerprintEnrollment";
import { writeAudit } from "./lib/audit";
import { findDuplicateCard } from "./lib/cardIdentity";

/**
 * Çalışana ait yüz fotoğraf kaydı (tek kişi = tek yüz). Convex storage'a yüklenir,
 * `pictureStorageId` referansı tutulur. Eklenince ilgili Hikvision cihazlara
 * scheduler ile sync tetiklenir.
 */

/**
 * Internal: yüz storage ref'ini çalışan için döner — action'lar bytes'ı sonra çeker.
 */
export const getStorageRef = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const face = await ctx.db
      .query("employeeFaces")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
    if (!face) return null;
    return {
      _id: face._id,
      pictureStorageId: face.pictureStorageId,
      projectId: face.projectId,
    };
  },
});

const employeeArgs = { employeeId: v.id("employees") };
const payloadOf = (row: Doc<"hikPendingOperations">): Record<string, unknown> => {
  const value: unknown = row.payload;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
};
const inFlight = (row: Doc<"hikPendingOperations">) => (row.status === "pending" || row.status === "processing") && Date.now() - (row.processingStartedAt ?? row.createdAt) < 15 * 60_000;
const delivered = (row: Doc<"hikPendingOperations">) => row.status === "done" && row.dismissedAt === undefined;

async function authorize(ctx: QueryCtx & { user: Doc<"users"> }, employeeId: Id<"employees">, adding = false) {
  const employee = await requireEmployeeAccess(ctx, employeeId);
  await requirePermission(ctx, ctx.user, employee.projectId, "biometrics.manage");
  if (adding) {
    await assertBiometricAllowed(ctx, employee.projectId);
    if (employee.isActive !== true || !employee.cardNumber.trim() || employee.terminationType === "transfer") throw new ConvexError("Yüz kaydı için kişi aktif ve kart numarası kayıtlı olmalıdır.");
  }
  return employee;
}

async function operations(ctx: QueryCtx, employee: Doc<"employees">) {
  const pages = await Promise.all((["addFace", "deleteFace"] as const).map(operation => ctx.db.query("hikPendingOperations").withIndex("by_employee_operation", q => q.eq("employeeId", employee._id).eq("operation", operation)).order("desc").take(50)));
  return pages.flat().filter(row => row.projectId === employee.projectId).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
}

async function deleteUnusedFaceBlob(ctx: MutationCtx, storageId: Id<"_storage">) {
  const profiles = await ctx.db.query("employees").withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).take(1);
  if (!profiles.length) await ctx.storage.delete(storageId);
}

export const listForEmployee = authedQuery({
  args: employeeArgs,
  handler: async (ctx, { employeeId }) => {
    const employee = await authorize(ctx, employeeId);
    const face = await ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", employeeId)).unique();
    const targets = await employeeDevices(ctx, employee);
    const rows = await operations(ctx, employee);
    const ids = new Set([...targets.map(device => device._id), ...rows.map(row => row.deviceId)]);
    const devices = await Promise.all([...ids].map(async deviceId => {
      const device = await ctx.db.get(deviceId);
      if (!device || device.projectId !== employee.projectId) return null;
      const row = rows.filter(item => item.deviceId === deviceId).sort((a, b) => b.createdAt - a.createdAt)[0];
      const current = row && (!face || payloadOf(row).faceStorageId === face.pictureStorageId);
      const stale = row && (row.status === "pending" || row.status === "processing") && !inFlight(row);
      return { _id: deviceId, name: device.name, target: targets.some(item => item._id === deviceId), status: stale || (current && row.dismissedAt !== undefined) ? "failed" : current ? row.status : "unknown", operation: row?.operation ?? null, error: stale ? "İşlem zaman aşımına uğradı; yeniden deneyin." : current ? row.lastError ?? (row.dismissedAt !== undefined ? "İşlem kapatıldı; cihaz teslimi doğrulanmadı." : null) : null };
    }));
    return { registered: !!face, addedAt: face?.addedAt ?? null, active: employee.isActive === true && !!employee.cardNumber.trim() && employee.terminationType !== "transfer", devices: devices.filter((device): device is NonNullable<typeof device> => device !== null), busy: rows.some(row => targets.some(device => device._id === row.deviceId) && inFlight(row)) };
  },
});

export function validateFacePhoto(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  if (data.length < 4 || data.length > 200 * 1024 || data[0] !== 0xff || data[1] !== 0xd8 || data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) throw new ConvexError("Yüz fotoğrafı JPEG biçiminde ve en fazla 200 KB olmalıdır.");
}

export const authorizeUpload = internalQuery({
  args: { ...employeeArgs, userId: v.id("users"), deviceId: v.optional(v.id("devices")) },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("Bu işlem için yetkiniz yok.");
    const employee = await authorize({ ...ctx, user }, args.employeeId, true);
    if (args.deviceId && !(await employeeDevices(ctx, employee)).some(device => device._id === args.deviceId)) throw new ConvexError("Cihaz kişinin aktif erişim kapsamında değil.");
    return null;
  },
});

export const savePhoto = authedAction({
  args: { ...employeeArgs, bytes: v.bytes() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.employeeFaces.authorizeUpload, { employeeId: args.employeeId, userId: ctx.user._id });
    validateFacePhoto(args.bytes);
    const storageId = await ctx.storage.store(new Blob([args.bytes], { type: "image/jpeg" }));
    try {
      await ctx.runMutation(internal.employeeFaces.saveStoredPhoto, { employeeId: args.employeeId, storageId, userId: ctx.user._id });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return null;
  },
});

async function queueDelivery(ctx: MutationCtx, employee: Doc<"employees">, removing: boolean, storageId?: Id<"_storage">, replacing = false) {
  const rows = await operations(ctx, employee);
  const targets = await employeeDevices(ctx, employee);
  const targetIds = new Set(targets.map(device => device._id));
  if (rows.some(row => targetIds.has(row.deviceId) && inFlight(row))) throw new ConvexError("Önce devam eden yüz gönderiminin bitmesini bekleyin.");
  for (const row of rows) if ((row.status === "pending" || row.status === "processing") && !inFlight(row)) await ctx.db.patch(row._id, { status: "failed", attemptCount: 5, lastError: "İşlem zaman aşımına uğradı." });
  if (!removing && rows.some(row => targetIds.has(row.deviceId) && row.operation === "deleteFace" && !delivered(row))) throw new ConvexError("Önce başarısız yüz silme işlemini yeniden deneyin.");
  if (targets.length > 200) throw new ConvexError("Cihaz kapsamı sınırı aşıldı.");
  const ids = new Set(targets.map(device => device._id));
  if (removing) for (const row of rows) ids.add(row.deviceId);
  const operationIds: Id<"hikPendingOperations">[] = [];
  for (const deviceId of ids) {
    const device = await ctx.db.get(deviceId);
    if (!device || device.projectId !== employee.projectId || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex) continue;
    const historical = rows.filter(row => row.deviceId === deviceId);
    const identities = removing ? new Set([employee.cardNumber.trim(), ...historical.map(row => payloadOf(row).employeeNo).filter((value): value is string => typeof value === "string" && value.length > 0)]) : new Set([employee.cardNumber.trim()]);
    for (const employeeNo of identities) {
      if (!employeeNo) continue;
      if (removing && await findDuplicateCard(ctx, employeeNo, employee._id)) continue;
      const previous = historical.find(row => payloadOf(row).employeeNo === employeeNo);
      const faceStorageId: unknown = storageId ?? (previous ? payloadOf(previous).faceStorageId : undefined);
      operationIds.push(await ctx.db.insert("hikPendingOperations", { employeeId: employee._id, deviceId, projectId: employee.projectId, operation: removing ? "deleteFace" : "addFace", payload: { employeeId: employee._id, employeeNo, replacing, ...(typeof faceStorageId === "string" ? { faceStorageId } : {}) }, status: "pending", attemptCount: 0, createdAt: Date.now() }));
    }
  }
  if (operationIds.length > 200) throw new ConvexError("Cihaz kapsamı sınırı aşıldı.");
  if (operationIds.length) await ctx.scheduler.runAfter(0, removing ? internal.actions.hikvisionSync.deleteEmployeeFaceFromDevicesInternal : internal.actions.hikvisionSync.syncEmployeeFaceToDevicesInternal, { employeeId: employee._id, operationIds });
}

export const saveStoredPhoto = internalMutation({
  args: { ...employeeArgs, storageId: v.id("_storage"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("Bu işlem için yetkiniz yok.");
    const employee = await authorize({ ...ctx, user }, args.employeeId, true);
    const old = await ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", args.employeeId)).unique();
    await queueDelivery(ctx, employee, false, args.storageId, !!old);
    const value = { employeeId: args.employeeId, projectId: employee.projectId, pictureStorageId: args.storageId, addedAt: Date.now() };
    if (old) { await ctx.db.patch(old._id, value); await deleteUnusedFaceBlob(ctx, old.pictureStorageId); }
    else await ctx.db.insert("employeeFaces", value);
    await writeAudit(ctx, { user, projectId: employee.projectId, action: old ? "update" : "create", targetTable: "employees", targetId: employee._id, note: old ? "Biyometrik yüz kaydı değiştirildi." : "Biyometrik yüz kaydı eklendi." });
    return null;
  },
});

export const resend = authedMutation({
  args: employeeArgs, returns: v.null(),
  handler: async (ctx, { employeeId }) => {
    const employee = await authorize(ctx, employeeId, true);
    const face = await ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", employeeId)).unique();
    if (!face) throw new ConvexError("Kayıtlı yüz yok.");
    await queueDelivery(ctx, employee, false, face.pictureStorageId, true);
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, note: "Biyometrik yüz yeniden gönderimi istendi." });
    return null;
  },
});

export const remove = authedMutation({
  args: employeeArgs, returns: v.null(),
  handler: async (ctx, { employeeId }) => {
    const employee = await authorize(ctx, employeeId);
    const face = await ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", employeeId)).unique();
    await queueDelivery(ctx, employee, true, face?.pictureStorageId);
    if (face) { await ctx.db.delete(face._id); await deleteUnusedFaceBlob(ctx, face.pictureStorageId); }
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "delete", targetTable: "employees", targetId: employeeId, note: "Biyometrik yüz silindi; cihaz silme işlemleri sıraya alındı." });
    return null;
  },
});

const deliveryArgs = { ...employeeArgs, operationIds: v.array(v.id("hikPendingOperations")) };
export const startDelivery = internalMutation({
  args: deliveryArgs,
  handler: async (ctx, args) => {
    if (args.operationIds.length > 200) throw new ConvexError("Cihaz kapsamı sınırı aşıldı.");
    const employee = await ctx.db.get(args.employeeId);
    const face = await ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", args.employeeId)).unique();
    const devices = employee ? await employeeDevices(ctx, employee) : [];
    const targets: { operationId: Id<"hikPendingOperations">; deviceId: Id<"devices">; devIndex: string; employeeNo: string; storageId: Id<"_storage"> | null; removing: boolean; replacing: boolean }[] = [];
    for (const id of args.operationIds) {
      const row = await ctx.db.get(id);
      if (!row || row.status !== "pending" || (row.operation !== "addFace" && row.operation !== "deleteFace") || payloadOf(row).employeeId !== args.employeeId) continue;
      const payload = payloadOf(row);
      const device = await ctx.db.get(row.deviceId);
      const removing = row.operation === "deleteFace";
      try {
        if (!device?.hikDevIndex || device.projectId !== row.projectId || device.brand !== "hikvision" || device.hikTransport !== "gateway" || typeof payload.employeeNo !== "string") throw new Error("Cihaz veya silme kimliği doğrulanamadı.");
        if (removing && await findDuplicateCard(ctx, payload.employeeNo, args.employeeId)) throw new Error("Eski kart kimliği başka kişiye ait; yüz silinmedi.");
        if (!removing) {
          if (!employee || !face || employee.isActive !== true || employee.terminationType === "transfer" || face.pictureStorageId !== payload.faceStorageId || employee.cardNumber.trim() !== payload.employeeNo || !devices.some(item => item._id === device._id)) throw new Error("Kişi, yüz kaydı veya erişim kapsamı değişti.");
          await assertBiometricAllowed(ctx, employee.projectId);
          await assertBiometricAllowed(ctx, device.projectId);
        }
        await ctx.db.patch(id, { status: "processing", processingStartedAt: Date.now() });
        targets.push({ operationId: id, deviceId: device._id, devIndex: device.hikDevIndex, employeeNo: payload.employeeNo, storageId: removing ? null : face?.pictureStorageId ?? null, removing, replacing: payload.replacing === true });
      } catch (error) { await ctx.db.patch(id, { status: "failed", attemptCount: 5, lastError: error instanceof Error ? error.message : "Yüz işlemi doğrulanamadı." }); }
    }
    return targets;
  },
});

export const finishDelivery = internalMutation({
  args: { results: v.array(v.object({ operationId: v.id("hikPendingOperations"), ok: v.boolean(), error: v.optional(v.string()) })) },
  returns: v.null(),
  handler: async (ctx, { results }) => {
    for (const result of results) {
      const row = await ctx.db.get(result.operationId);
      if (!row || row.status !== "processing") continue;
      await ctx.db.patch(row._id, { status: result.ok ? "done" : "failed", completedAt: Date.now(), lastError: result.ok ? undefined : result.error ?? "Cihaz işlemi tamamlanamadı.", attemptCount: 5, ...(result.ok ? { dismissedAt: undefined } : {}) });
      if (!result.ok) continue;
      if (!row.employeeId) continue;
      const previous = await ctx.db.query("hikPendingOperations").withIndex("by_employee_operation", q => q.eq("employeeId", row.employeeId).eq("operation", row.operation)).order("desc").take(50);
      for (const old of previous) if (old.deviceId === row.deviceId && (old.status === "failed" || old.dismissedAt !== undefined) && payloadOf(old).employeeId === payloadOf(row).employeeId && payloadOf(old).faceStorageId === payloadOf(row).faceStorageId && payloadOf(old).employeeNo === payloadOf(row).employeeNo) await ctx.db.patch(old._id, { status: "done", completedAt: Date.now(), lastError: undefined, dismissedAt: undefined });
    }
    return null;
  },
});

