import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { classifyImportPerson, splitDevicePersonName, type ImportPerson, type ImportRow } from "./lib/hikDeviceImport";
import { findDuplicateCard } from "./lib/cardIdentity";
import { upsertGroupMembership } from "./employees";
import { writeAudit } from "./lib/audit";
import { enrollmentTarget, validateFingerNo } from "./fingerprintEnrollment";
import { MAX_FINGERPRINTS_PER_EMPLOYEE } from "./lib/fingerprintSlots";
import { requirePermission } from "./lib/permissions";
import { isProjectAllowed, getProjectIdsForUser } from "./lib/auth";
import { isBiometricEnabled } from "./lib/privacySettings";

const personValidator = v.object({ employeeNo: v.string(), name: v.string(), cards: v.array(v.string()), fingerCount: v.number() });
async function classify(ctx: QueryCtx, person: ImportPerson, projectId: Id<"projects">): Promise<ImportRow> {
  const duplicates: Doc<"employees">[] = [];
  for (const identity of new Set([person.employeeNo, ...person.cards])) {
    const duplicate = await findDuplicateCard(ctx, identity);
    if (duplicate) {
      duplicates.push(duplicate);
      const second = await findDuplicateCard(ctx, identity, duplicate._id);
      if (second) duplicates.push(second);
    }
  }
  return classifyImportPerson(person, projectId, duplicates);
}
export const classifyPersons = internalQuery({
  args: { projectId: v.id("projects"), persons: v.array(personValidator) },
  handler: async (ctx, args): Promise<ImportRow[]> => {
    const rows: ImportRow[] = [];
    for (const person of args.persons) rows.push(await classify(ctx, person, args.projectId));
    return rows;
  },
});

/** Atomic recheck, creation, consent, and rule membership for one person. */
export const createPerson = internalMutation({
  args: { deviceId: v.id("devices"), userId: v.id("users"), person: personValidator, consent: v.boolean() },
  handler: async (ctx, args): Promise<{ row: ImportRow; employeeId?: Id<"employees">; ruleId?: Id<"accessRules">; consentRecorded: boolean }> => {
    const device = await ctx.db.get(args.deviceId);
    const user = await ctx.db.get(args.userId);
    if (!device?.projectId || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex || !user) throw new Error("Aktarım hedefi bulunamadı");
    const authCtx = { ...ctx, user };
    if (!isProjectAllowed(await getProjectIdsForUser(authCtx), device.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    await requirePermission(ctx, user, device.projectId, "devices.manage");
    await requirePermission(ctx, user, device.projectId, "employees.manage");
    const row = await classify(ctx, args.person, device.projectId);
    if (row.status !== "new") return { row, consentRecorded: false };
    if (!row.employeeNo.trim()) throw new Error("Cihaz kişi numarası boş");
    const now = new Date().toISOString();
    const employeeId = await ctx.db.insert("employees", {
      ...splitDevicePersonName(row.name), email: "", cardNumber: row.employeeNo,
      projectId: device.projectId, isActive: true, ...(row.cards.length === 0 ? { hikCardless: true } : {}), createdAt: now, updatedAt: now,
    });
    const name = `${device.name} mevcut kişiler`;
    let ruleId: Id<"accessRules"> | undefined;
    for await (const rule of ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", device.projectId))) {
      if (rule.name === name) { ruleId = rule._id; break; }
    }
    // Import is authorized by devices.manage + employees.manage. The general rule editor
    // helper additionally requires accessRules.manage, so build this fixed scope here.
    if (!ruleId) {
      ruleId = await ctx.db.insert("accessRules", { name, projectId: device.projectId, isActive: true, startTime: "00:00", endTime: "23:59", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], createdAt: now, updatedAt: now });
      await ctx.db.insert("groupDevices", { groupId: ruleId, deviceId: args.deviceId, projectId: device.projectId, createdAt: now });
    } else {
      const existingRuleId = ruleId;
      const rule = await ctx.db.get(existingRuleId);
      const links = await ctx.db.query("groupDevices").withIndex("by_group", q => q.eq("groupId", existingRuleId)).take(201);
      const doors = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", existingRuleId)).take(201);
      if (!rule || rule.isActive === false || rule.startTime !== "00:00" || rule.endTime !== "23:59" || rule.days?.length !== 7 || links.length !== 1 || links[0]?.deviceId !== args.deviceId || doors.length) throw new Error("Aktarım kuralı değiştirilmiş; erişim kapsamını kontrol edin");
    }
    await upsertGroupMembership(ctx, employeeId, ruleId, device.projectId);
    const consentRecorded = args.consent && row.fingerCount > 0;
    if (consentRecorded) await ctx.db.insert("employeeConsents", { employeeId, consentType: "biometric_fingerprint", grantedAt: now, grantedBy: user._id, notes: `Cihazdan aktarım: ${device.name}` });
    await writeAudit(ctx, { user, projectId: device.projectId, action: "create", targetTable: "employees", targetId: employeeId, newValue: { cardNumber: row.employeeNo }, note: `Cihazdan aktarım: ${device.name}` });
    return { row, employeeId, ruleId, consentRecorded };
  },
});

export const biometricEnabled = internalQuery({ args: { projectId: v.id("projects") }, handler: (ctx, args) => isBiometricEnabled(ctx, args.projectId) });

/** Record a device-resident source delivery before upsertEncrypted's consent/scope checks. */
export const recordSource = internalMutation({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), userId: v.id("users"), expectedCardNumber: v.string() },
  handler: async (ctx, args) => {
    validateFingerNo(args.fingerNo);
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.deviceId);
    const user = await ctx.db.get(args.userId);
    if (!user || employee.cardNumber !== args.expectedCardNumber) throw new Error("Kişi bilgileri değişti");
    await requirePermission(ctx, user, employee.projectId, "biometrics.manage");
    const templates = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", args.employeeId)).take(11);
    if (templates.filter(template => template.fingerPrintID !== args.fingerNo).length >= MAX_FINGERPRINTS_PER_EMPLOYEE) throw new Error("Parmak izi sınırı aşıldı");
    const existing = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (existing?.attemptId || existing?.deletionEmployeeNo !== undefined) throw new Error("Cihazda işlem sürüyor");
    const value = { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber, enrolledBy: user._id };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("deviceFingerprintEnrollments", value);
  },
});

export const scheduleSync = internalMutation({
  args: { employeeId: v.id("employees"), ruleId: v.id("accessRules") },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: args.ruleId });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: args.employeeId });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: args.employeeId });
  },
});
