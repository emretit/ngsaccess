import { scheduleFingerprintPurge } from "./lib/employeeCardChange";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { canAccessEmployeeProject, getProjectIdsForUser, requireEmployeeAccess } from "./lib/auth";
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
async function employeeDevices(ctx: QueryCtx, employee: Doc<"employees">) {
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

async function enrollmentTarget(ctx: QueryCtx, employeeId: Id<"employees">, deviceId: Id<"devices">) {
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

export const listForEmployee = adminQuery({
  args: { employeeId: v.id("employees") },
  returns: v.object({
    devices: v.array(v.object({ _id: v.id("devices"), name: v.string(), capabilitiesScanned: v.boolean() })),
    enrollments: v.array(v.object({ _id: v.id("deviceFingerprintEnrollments"), deviceId: v.id("devices"), fingerNo: v.number(), enrolledAt: v.string(), deviceName: v.string() })),
    active: v.boolean(),
  }),
  handler: async (ctx, { employeeId }) => {
    const employee = await requireEmployeeAccess(ctx, employeeId);
    const devices = await employeeDevices(ctx, employee);
    const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(1000);
    const enrollments = await Promise.all(rows.filter(row => !!row.enrolledAt).map(async row => ({
      _id: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, enrolledAt: row.enrolledAt,
      deviceName: (await ctx.db.get(row.deviceId))?.name ?? "Silinmiş cihaz",
    })));
    return { devices: devices.filter(device => fingerprintCapability(device.hikCapabilitiesSnapshot) !== false).map(device => ({
      _id: device._id, name: device.name, capabilitiesScanned: fingerprintCapability(device.hikCapabilitiesSnapshot) !== null,
    })), enrollments, active: employee.isActive === true };
  },
});

export const getTargetInternal = internalQuery({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices"), userId: v.id("users"), removing: v.optional(v.boolean()) },
  returns: v.object({ employee: employeeValidator, device: deviceValidator }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || (user.role !== "super_admin" && user.role !== "project_admin")) throw new ConvexError("Yönetici yetkisi gerekiyor.");
    const allowed = await getProjectIdsForUser({ ...ctx, user });
    const employee = await ctx.db.get(args.employeeId);
    const device = await ctx.db.get(args.deviceId);
    if (!employee || !device) throw new ConvexError("Kişi veya cihaz bulunamadı.");
    if (!canAccessEmployeeProject(user.role, allowed, employee.projectId) || !canAccessEmployeeProject(user.role, allowed, device.projectId) || employee.projectId !== device.projectId) throw new ConvexError("Bu kişi veya cihaza erişim yetkiniz yok.");
    if (args.removing) {
      if (device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex) throw new ConvexError("Cihazın Hik gateway bağlantısı yok.");
      return { employee, device };
    }
    return enrollmentTarget(ctx, args.employeeId, args.deviceId);
  },
});

export const beginEnrollment = adminMutation({
  args: targetArgs,
  returns: v.string(),
  handler: async (ctx, args) => {
    validateFingerNo(args.fingerNo);
    await requireEmployeeAccess(ctx, args.employeeId);
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
    const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_device", q => q.eq("deviceId", args.deviceId)).take(1001);
    if (rows.length > 1000 || rows.some(row => (row.pendingUntil ?? 0) > Date.now())) throw new ConvexError("Bu cihazda başka bir parmak izi işlemi sürüyor; bitmesini bekleyin.");
    const existing = rows.find(row => row.employeeId === args.employeeId && row.fingerNo === args.fingerNo);
    if (existing?.deletionEmployeeNo !== undefined) throw new ConvexError("Önce cihazdaki eski parmak izi kaydını silin.");
    const state = { attemptId: crypto.randomUUID(), pendingUntil: Date.now() + 180_000, cancelRequested: false };
    if (existing) await ctx.db.patch(existing._id, state);
    else await ctx.db.insert("deviceFingerprintEnrollments", { ...args, projectId: employee.projectId, enrolledAt: "", enrolledBy: ctx.user._id, ...state });
    return state.attemptId;
  },
});

export const cancelEnrollment = adminMutation({
  args: { ...targetArgs, attemptId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEmployeeAccess(ctx, args.employeeId);
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
    await ctx.db.patch(row._id, { enrolledAt: new Date().toISOString(), enrolledBy: args.enrolledBy, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
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
  args: { employeeId: v.id("employees"), employeeNo: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await scheduleFingerprintPurge(ctx, args.employeeId, args.employeeNo);
    return null;
  },
});
