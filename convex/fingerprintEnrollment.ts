import { requirePermission } from "./lib/permissions";
import { scheduleFingerprintPurge } from "./lib/employeeCardChange";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { canAccessEmployeeProject, getProjectIdsForUser, requireEmployeeAccess } from "./lib/auth";
import { internal } from "./_generated/api";
import { writeAudit } from "./lib/audit";
import { assertBiometricAllowed } from "./lib/biometricGate";

const targetArgs = { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number() };

const employeeValidator = v.object({ ...schema.tables.employees.validator.fields, _id: v.id("employees"), _creationTime: v.number() });
const deviceValidator = v.object({ ...schema.tables.devices.validator.fields, _id: v.id("devices"), _creationTime: v.number() });
const enrollmentValidator = v.object({ ...schema.tables.deviceFingerprintEnrollments.validator.fields, _id: v.id("deviceFingerprintEnrollments"), _creationTime: v.number() });


export function validateFingerNo(fingerNo: number) {
  if (!Number.isInteger(fingerNo) || fingerNo < 1 || fingerNo > 10) throw new ConvexError("Parmak numarası 1–10 arasında tam sayı olmalıdır.");
}

export function fingerprintCapability(raw?: string): boolean | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("probes" in value) || !Array.isArray(value.probes)) return null;
    for (const probe of value.probes as unknown[]) {
      if (probe && typeof probe === "object" && "key" in probe && probe.key === "captureFingerprint" && "supported" in probe && typeof probe.supported === "boolean") return probe.supported;
    }
  } catch { /* Missing or invalid scans are unknown, never an implicit rejection. */ }
  return null;
}

/** Same project and active rule; both device and door assignments grant scope. */
export async function employeeDevices(ctx: QueryCtx, employee: Doc<"employees">) {
  const members = await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id)).take(201);
  if (members.length > 200) throw new ConvexError("Erişim grubu sınırı aşıldı; yöneticinize başvurun.");
  const ids = new Set<Id<"devices">>();
  for (const member of members) {
    const rule = await ctx.db.get(member.groupId);
    if (!rule || rule.isActive === false || rule.projectId !== employee.projectId) continue;
    const [links, doors] = await Promise.all([
      ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", employee.projectId).eq("groupId", member.groupId)).take(201),
      ctx.db.query("groupDoors").withIndex("by_project_group", q => q.eq("projectId", employee.projectId).eq("groupId", member.groupId)).take(201),
    ]);
    if (links.length > 200 || doors.length > 200) throw new ConvexError("Cihaz kapsamı sınırı aşıldı; yöneticinize başvurun.");
    for (const link of links) ids.add(link.deviceId);
    for (const link of doors) {
      const door = await ctx.db.get(link.doorId);
      if (door?.deviceId && door.projectId === employee.projectId) ids.add(door.deviceId);
    }
  }
  const devices = await Promise.all([...ids].map(id => ctx.db.get(id)));
  return devices.filter((device): device is NonNullable<typeof device> => device !== null)
    .filter(device => device.projectId === employee.projectId && device.isActive !== false && device.brand === "hikvision" && device.hikTransport === "gateway" && !!device.hikDevIndex);
}

export async function enrollmentTarget(ctx: QueryCtx, employeeId: Id<"employees">, deviceId: Id<"devices">) {
  const employee = await ctx.db.get(employeeId);
  const device = await ctx.db.get(deviceId);
  if (!employee || !device) throw new ConvexError("Kişi veya cihaz bulunamadı.");
  if (employee.isActive !== true) throw new ConvexError("Pasif kişiye parmak izi kaydedilemez.");
  if (!employee.cardNumber?.trim()) throw new ConvexError("Önce kişinin kart numarasını kaydedin ve cihazla senkronize edin.");
  if (!(await employeeDevices(ctx, employee)).some(item => item._id === deviceId)) throw new ConvexError("Cihaz kişinin aktif erişim kapsamında değil veya Hik gateway bağlantısı yok.");
  if (fingerprintCapability(device.hikCapabilitiesSnapshot) === false) throw new ConvexError("Bu cihaz parmak izi kaydını desteklemiyor");
  await assertBiometricAllowed(ctx, employee.projectId);
  await assertBiometricAllowed(ctx, device.projectId);
  const consents = await ctx.db.query("employeeConsents").withIndex("by_employee_type", q => q.eq("employeeId", employeeId).eq("consentType", "biometric_fingerprint")).take(201);
  if (consents.length > 200 || !consents.some(consent => !consent.revokedAt)) throw new ConvexError("Parmak izi kaydı için kişinin açık rızası gereklidir.");
  return { employee, device };
}

export const listForEmployee = authedQuery({
  args: { employeeId: v.id("employees") },
  returns: v.object({
    devices: v.array(v.object({ _id: v.id("devices"), name: v.string(), capabilitiesScanned: v.boolean() })),
    enrollments: v.array(v.object({ _id: v.id("deviceFingerprintEnrollments"), deviceId: v.id("devices"), fingerNo: v.number(), enrolledAt: v.string(), deviceName: v.string() })),
    templates: v.array(v.object({ fingerNo: v.number(), enrolledAt: v.string(), deviceIds: v.array(v.id("devices")) })),
    active: v.boolean(),
  }),
  handler: async (ctx, { employeeId }) => {
    const employee = await requireEmployeeAccess(ctx, employeeId);
    await requirePermission(ctx, ctx.user, employee.projectId, "biometrics.manage");
    const devices = await employeeDevices(ctx, employee);
    const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(1000);
    const enrollments = await Promise.all(rows.filter(row => !!row.enrolledAt).map(async row => ({
      _id: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, enrolledAt: row.enrolledAt,
      deviceName: (await ctx.db.get(row.deviceId))?.name ?? "Silinmiş cihaz",
    })));
    const templates = (await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(11)).map(template => ({
      fingerNo: template.fingerPrintID, enrolledAt: new Date(template.addedAt).toISOString(),
      deviceIds: [...new Set(rows.filter(row => row.fingerNo === template.fingerPrintID && !!row.enrolledAt && row.deletionEmployeeNo === undefined).map(row => row.deviceId))],
    }));
    // Retain visibility/removal of source-only captures if central persistence failed.
    for (const row of rows) {
      if (row.enrolledAt && !templates.some(template => template.fingerNo === row.fingerNo)) templates.push({ fingerNo: row.fingerNo, enrolledAt: row.enrolledAt, deviceIds: rows.filter(item => item.fingerNo === row.fingerNo && !!item.enrolledAt && item.deletionEmployeeNo === undefined).map(item => item.deviceId) });
    }
    templates.sort((a, b) => a.fingerNo - b.fingerNo);
    return { templates, devices: devices.filter(device => fingerprintCapability(device.hikCapabilitiesSnapshot) !== false).map(device => ({
      _id: device._id, name: device.name, capabilitiesScanned: fingerprintCapability(device.hikCapabilitiesSnapshot) !== null,
    })), enrollments, active: employee.isActive === true };
  },
});

export const getTargetInternal = internalQuery({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices"), userId: v.id("users"), removing: v.optional(v.boolean()) },
  returns: v.object({ employee: employeeValidator, device: deviceValidator }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("Bu işlem için yetkiniz yok");
    const allowed = await getProjectIdsForUser({ ...ctx, user });
    const employee = await ctx.db.get(args.employeeId);
    const device = await ctx.db.get(args.deviceId);
    if (!employee || !device) throw new ConvexError("Kişi veya cihaz bulunamadı.");
    await requirePermission(ctx, user, employee.projectId, "biometrics.manage");
    await requirePermission(ctx, user, device.projectId, "biometrics.manage");
    if (!canAccessEmployeeProject(user.role, allowed, employee.projectId) || !canAccessEmployeeProject(user.role, allowed, device.projectId) || employee.projectId !== device.projectId) throw new ConvexError("Bu kişi veya cihaza erişim yetkiniz yok.");
    if (args.removing) {
      if (device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex) throw new ConvexError("Cihazın Hik gateway bağlantısı yok.");
      return { employee, device };
    }
    return enrollmentTarget(ctx, args.employeeId, args.deviceId);
  },
});

export const beginEnrollment = authedMutation({
  args: targetArgs,
  returns: v.string(),
  handler: async (ctx, args) => {
    validateFingerNo(args.fingerNo);
    const permittedEmployee = await requireEmployeeAccess(ctx, args.employeeId);
    await requirePermission(ctx, ctx.user, permittedEmployee.projectId, "biometrics.manage");
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
    const pending = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_device_pendingUntil", q => q.eq("deviceId", args.deviceId).gt("pendingUntil", Date.now())).first();
    if (pending) throw new ConvexError("Bu cihazda başka bir parmak izi işlemi sürüyor; bitmesini bekleyin.");
    const existing = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (existing?.deletionEmployeeNo !== undefined) throw new ConvexError("Önce cihazdaki eski parmak izi kaydını silin.");
    const state = { attemptId: crypto.randomUUID(), pendingUntil: Date.now() + 180_000, cancelRequested: false };
    if (existing) await ctx.db.patch(existing._id, state);
    else await ctx.db.insert("deviceFingerprintEnrollments", { ...args, projectId: employee.projectId, enrolledAt: "", enrolledBy: ctx.user._id, ...state });
    return state.attemptId;
  },
});

export const cancelEnrollment = authedMutation({
  args: { ...targetArgs, attemptId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const permittedEmployee = await requireEmployeeAccess(ctx, args.employeeId);
    await requirePermission(ctx, ctx.user, permittedEmployee.projectId, "biometrics.manage");
    const row = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (row?.attemptId === args.attemptId) await ctx.db.patch(row._id, { cancelRequested: true });
    return null;
  },
});

export const getAttempt = internalQuery({
  args: { ...targetArgs, attemptId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    return row?.attemptId === args.attemptId && !row.cancelRequested && (row.pendingUntil ?? 0) > Date.now();
  },
});

export const upsert = internalMutation({
  args: { ...targetArgs, attemptId: v.string(), enrolledBy: v.id("users"), expectedCardNumber: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
    const row = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (!row || row.attemptId !== args.attemptId || row.cancelRequested || (row.pendingUntil ?? 0) <= Date.now() || employee.cardNumber.trim() !== args.expectedCardNumber.trim()) throw new ConvexError("Kayıt iptal edildi veya kişi bilgileri değişti; yeniden deneyin.");
    await ctx.db.patch(row._id, { enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber.trim(), enrolledBy: args.enrolledBy, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
    return null;
  },
});

export const finishAttempt = internalMutation({
  args: { ...targetArgs, attemptId: v.string(), clearEnrolled: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (row?.attemptId === args.attemptId && row.deletionEmployeeNo === undefined) {
      if (!row.enrolledAt || args.clearEnrolled) await ctx.db.delete(row._id);
      else await ctx.db.patch(row._id, { attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
    }
    return null;
  },
});

export const getInternal = internalQuery({ args: { enrollmentId: v.id("deviceFingerprintEnrollments") }, returns: v.union(enrollmentValidator, v.null()), handler: (ctx, args) => ctx.db.get(args.enrollmentId) });
export const getPurgeDevice = internalQuery({
  args: { deviceId: v.id("devices") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    return device?.brand === "hikvision" && device.hikTransport === "gateway" ? device.hikDevIndex ?? null : null;
  },
});
export const remove = internalMutation({ args: { enrollmentId: v.id("deviceFingerprintEnrollments") }, returns: v.null(), handler: async (ctx, args) => { if (await ctx.db.get(args.enrollmentId)) await ctx.db.delete(args.enrollmentId); return null; } });
export const removeAllForEmployee = internalMutation({
  args: { employeeId: v.id("employees"), employeeNo: v.string(), fingerNo: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await scheduleFingerprintPurge(ctx, args.employeeId, args.employeeNo, { deleteTemplates: true, fingerNo: args.fingerNo });
    return null;
  },
});


export const authorizeEmployee = internalQuery({
  args: { employeeId: v.id("employees"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("Bu işlem için yetkiniz yok");
    const employee = await requireEmployeeAccess({ ...ctx, user }, args.employeeId);
    await requirePermission(ctx, user, employee.projectId, "biometrics.manage");
    return null;
  },
});

export const getPushDevices = internalQuery({
  args: { employeeId: v.id("employees") },
  returns: v.array(v.id("devices")),
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    return employee ? (await employeeDevices(ctx, employee)).filter(device => fingerprintCapability(device.hikCapabilitiesSnapshot) !== false).map(device => device._id) : [];
  },
});

export const getPushTarget = internalQuery({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices") },
  returns: v.union(v.object({ employee: employeeValidator, device: deviceValidator }), v.null()),
  handler: async (ctx, args) => {
    try {
      const target = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
      const pending = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_device_pendingUntil", q => q.eq("deviceId", args.deviceId).gt("pendingUntil", Date.now())).first();
      if (pending) return null;
      const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId)).collect();
      if (rows.some(row => row.deviceId === args.deviceId && row.deletionEmployeeNo === target.employee.cardNumber.trim())) return null;
      return target;
    } catch { return null; }
  },
});

export const recordPush = internalMutation({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), templateId: v.id("employeeFingerprints"), addedAt: v.number(), expectedCardNumber: v.string(), attemptId: v.string(), enrolledBy: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.employeeId !== args.employeeId || template.fingerPrintID !== args.fingerNo || template.addedAt !== args.addedAt || employee.cardNumber.trim() !== args.expectedCardNumber.trim()) throw new ConvexError("Kayıt değişti.");
    const row = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (!row || row.attemptId !== args.attemptId || row.cancelRequested || (row.deletionEmployeeNo !== undefined && row.deletionEmployeeNo !== args.expectedCardNumber.trim())) throw new ConvexError("Cihazda işlem sürüyor.");
    const enrolledBy = template.enrolledBy;
    if (!enrolledBy) throw new ConvexError("Kayıt sahibi bulunamadı.");
    const value = { employeeId: args.employeeId, projectId: employee.projectId, deviceId: args.deviceId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber.trim(), enrolledBy, deletionEmployeeNo: undefined, deletionRequestedAt: undefined, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined };
    await ctx.db.patch(row._id, value);
    return null;
  },
});

export const removeFingerprint = authedMutation({
  args: { employeeId: v.id("employees"), fingerNo: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateFingerNo(args.fingerNo);
    const employee = await requireEmployeeAccess(ctx, args.employeeId);
    await requirePermission(ctx, ctx.user, employee.projectId, "biometrics.manage");
    const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", args.employeeId)).collect();
    await scheduleFingerprintPurge(ctx, args.employeeId, employee.cardNumber, { deleteTemplates: true, fingerNo: args.fingerNo });
    const deviceCount = new Set(rows.filter(row => row.fingerNo === args.fingerNo).map(row => row.deviceId)).size;
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "delete", targetTable: "employees", targetId: args.employeeId, oldValue: { employeeId: args.employeeId }, note: `Parmak izi silindi; parmak no: ${args.fingerNo}; cihaz sayısı: ${deviceCount}` });
    return null;
  },
});


/** Reserve before transport, so concurrent privacy removal sees the in-flight send. */
export const beginPush = internalMutation({
  args: { ...targetArgs, templateId: v.id("employeeFingerprints"), addedAt: v.number(), expectedCardNumber: v.string(), force: v.optional(v.boolean()) },
  returns: v.union(v.object({ current: v.literal(true) }), v.object({ enrollmentId: v.id("deviceFingerprintEnrollments"), attemptId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.employeeId !== args.employeeId || template.fingerPrintID !== args.fingerNo || template.addedAt !== args.addedAt || !template.enrolledBy || employee.cardNumber.trim() !== args.expectedCardNumber.trim()) return null;
    const pending = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_device_pendingUntil", q => q.eq("deviceId", args.deviceId).gt("pendingUntil", Date.now())).first();
    if (pending) return null;
    const row = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (row?.deletionEmployeeNo !== undefined) return null;
    if (!args.force && row?.enrolledEmployeeNo === employee.cardNumber.trim() && Date.parse(row.enrolledAt) >= template.addedAt) return { current: true as const };
    const state = { attemptId: crypto.randomUUID(), pendingUntil: Date.now() + 180_000, cancelRequested: false, deletionEmployeeNo: employee.cardNumber.trim(), deletionRequestedAt: Date.now() };
    const enrollmentId = row ? row._id : await ctx.db.insert("deviceFingerprintEnrollments", { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: "", enrolledBy: template.enrolledBy, ...state });
    if (row) await ctx.db.patch(row._id, state);
    return { enrollmentId, attemptId: state.attemptId };
  },
});

export const queuePushCleanup = internalMutation({
  args: { enrollmentId: v.id("deviceFingerprintEnrollments"), employeeNo: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.enrollmentId);
    if (!row) return null; // Purge never removes an in-flight reservation.
    await ctx.db.patch(row._id, { deletionEmployeeNo: args.employeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), pendingUntil: undefined, cancelRequested: true });
    await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots: [{ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: args.employeeNo }] });
    return null;
  },
});

/** Page all metadata, including legacy tombstones and rows whose employee was deleted. */
export const retryStalePurges = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("deviceFingerprintEnrollments").paginate({ cursor: args.cursor ?? null, numItems: 100 });
    const snapshots = page.page.filter(row => row.deletionEmployeeNo !== undefined && (row.deletionRequestedAt ?? row._creationTime) <= Date.now() - 3_600_000).map(row => ({ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: row.deletionEmployeeNo ?? "" }));
    if (snapshots.length) await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots });
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.fingerprintEnrollment.retryStalePurges, { cursor: page.continueCursor });
    return null;
  },
});

export const auditResend = authedMutation({
  args: { employeeId: v.id("employees"), fingerNo: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateFingerNo(args.fingerNo);
    const employee = await requireEmployeeAccess(ctx, args.employeeId);
    await requirePermission(ctx, ctx.user, employee.projectId, "biometrics.manage");
    const devices = await employeeDevices(ctx, employee);
    const deviceCount = devices.filter(device => fingerprintCapability(device.hikCapabilitiesSnapshot) !== false).length;
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: args.employeeId, newValue: { employeeId: args.employeeId }, note: `Parmak izi yeniden gönderimi istendi; parmak no: ${args.fingerNo}; cihaz sayısı: ${deviceCount}` });
    return null;
  },
});
