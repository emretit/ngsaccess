import { insertEmployee } from "./lib/employeeListFields";
import { hikPersonIdentity } from "./lib/hikPersonIdentity";
import { cardNumberError } from "./lib/cardNumberRules";
import { v } from "convex/values";
import { internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import { internalMutation } from "./lib/dashboardMutations";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { classifyImportPerson, importedValidity, splitDevicePersonName, type ImportPerson, type ImportRow } from "./lib/hikDeviceImport";
import { findDuplicateCard } from "./lib/cardIdentity";
import { upsertGroupMembership } from "./employees";
import { writeAudit } from "./lib/audit";
import { recordDepartmentChange } from "./lib/employeeDepartmentHistory";
import { validateFingerNo } from "./fingerprintEnrollment";
import { MAX_FINGERPRINTS_PER_EMPLOYEE } from "./lib/fingerprintSlots";
import { requirePermission } from "./lib/permissions";
import { isProjectAllowed, getProjectIdsForUser } from "./lib/auth";
import { assertBiometricAllowed } from "./lib/biometricGate";
import { isBiometricEnabled } from "./lib/privacySettings";

const personValidator = v.object({ employeeNo: v.string(), name: v.string(), cards: v.array(v.string()), fingerCount: v.number(), valid: v.optional(v.object({ enable: v.optional(v.boolean()), beginTime: v.optional(v.string()), endTime: v.optional(v.string()), timeType: v.optional(v.string()) })), doorRight: v.optional(v.string()), rightPlans: v.optional(v.array(v.object({ doorNo: v.number(), planTemplateNo: v.string() }))) });
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
  const identities = await ctx.db.query("employees").withIndex("by_project_hikEmployeeNo", q => q.eq("projectId", projectId).eq("hikEmployeeNo", person.employeeNo)).take(2);
  const identityMatch = identities[0];
  const invalidCard = person.cards.map(card => cardNumberError(card)).find(error => error !== undefined);
  const row: ImportRow = invalidCard ? { ...person, status: "manual", reason: invalidCard }
    : person.cards.length > 1 ? { ...person, status: "manual", reason: "Birden çok kart var; cihaz kişi numarası ve kartları elle eşleştirilmeli." }
    : identities.length > 1 || (identityMatch && duplicates.some(duplicate => duplicate._id !== identityMatch._id)) ? { ...person, status: "conflict", reason: "Cihaz kişi numarası veya kartı başka kayıtta kullanılıyor" }
    : identityMatch ? { ...person, status: "matched", matchedEmployeeId: identityMatch._id }
    : classifyImportPerson(person, projectId, duplicates);
  if (row.status === "matched" && row.matchedEmployeeId) {
    const employeeId = row.matchedEmployeeId;
    const stored = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(11);
    row.storedFingerCount = stored.length;
  }
  return row;
}
export const classifyPersons = internalQuery({
  args: { projectId: v.id("projects"), persons: v.array(personValidator) },
  handler: async (ctx, args): Promise<ImportRow[]> => {
    if (args.persons.length > 10) throw new Error("Bir sayfada en fazla 10 kişi sınıflandırılabilir");
    const rows: ImportRow[] = [];
    for (const person of args.persons) rows.push(await classify(ctx, person, args.projectId));
    return rows;
  },
});

/** Atomic recheck, creation, and rule membership for one person. */
type CreateArgs = { deviceId: Id<"devices">; userId: Id<"users">; person: ImportPerson; grantFullDeviceAccess?: boolean };
type CreatedPerson = { row: ImportRow; employeeId?: Id<"employees">; ruleId?: Id<"accessRules"> };
async function createImportedPerson(ctx: MutationCtx, args: CreateArgs): Promise<CreatedPerson> {
    const device = await ctx.db.get(args.deviceId);
    const user = await ctx.db.get(args.userId);
    if (!device?.projectId || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex || !user) throw new Error("Aktarım hedefi bulunamadı");
    const authCtx = { ...ctx, user };
    if (!isProjectAllowed(await getProjectIdsForUser(authCtx), device.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    await requirePermission(ctx, user, device.projectId, "devices.manage");
    await requirePermission(ctx, user, device.projectId, "employees.manage");
    if (args.grantFullDeviceAccess) await requirePermission(ctx, user, device.projectId, "accessRules.manage");
    const row = await classify(ctx, args.person, device.projectId);
    if (row.status !== "new") return { row };
    if (!row.employeeNo.trim()) throw new Error("Cihaz kişi numarası boş");
    const now = new Date().toISOString();
    const validity = importedValidity(row.valid, Date.now());
    const employeeId = await insertEmployee(ctx, {
      ...splitDevicePersonName(row.name), email: "", cardNumber: row.cards[0] ?? "", hikEmployeeNo: row.employeeNo,
      projectId: device.projectId, ...validity, ...(row.cards.length === 0 ? { hikCardless: true } : {}), createdAt: now, updatedAt: now,
    });
    let ruleId: Id<"accessRules"> | undefined;
    await recordDepartmentChange(ctx, employeeId);
    if (args.grantFullDeviceAccess && validity.isActive) {
      const name = `${device.name} mevcut kişiler`;
      const projectRules = await ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", device.projectId)).take(201);
      if (projectRules.length > 200) throw new Error("Erişim kuralları aktarım sınırını aşıyor; kişileri erişim genişletmeden aktarın");
      for (const rule of projectRules) {
        if (rule.name === name) { ruleId = rule._id; break; }
      }
      // Only an explicit, permission-checked choice may create this broad rule.
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
    }
    await writeAudit(ctx, { user, projectId: device.projectId, action: "create", targetTable: "employees", targetId: employeeId, newValue: { cardNumber: row.employeeNo }, note: `Cihazdan aktarım: ${device.name}` });
    return { row, employeeId, ruleId };
}
export const createPerson = internalMutation({
  args: { deviceId: v.id("devices"), userId: v.id("users"), person: personValidator, grantFullDeviceAccess: v.optional(v.boolean()) },
  handler: createImportedPerson,
});
export const createPersons = internalMutation({
  args: { deviceId: v.id("devices"), userId: v.id("users"), persons: v.array(personValidator), grantFullDeviceAccess: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<CreatedPerson[]> => {
    if (args.persons.length > 10) throw new Error("Bir sayfada en fazla 10 kişi aktarılabilir");
    const results: CreatedPerson[] = [];
    for (const person of args.persons) results.push(await createImportedPerson(ctx, { ...args, person }));
    const ruleIds = new Set(results.flatMap(result => result.ruleId ? [result.ruleId] : []));
    for (const accessRuleId of ruleIds) {
      const targetEmployeeIds = results.flatMap(result => result.ruleId === accessRuleId && result.employeeId ? [result.employeeId] : []);
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId, targetEmployeeIds });
    }
    return results;
  },
});

export const biometricEnabled = internalQuery({ args: { projectId: v.id("projects") }, handler: (ctx, args) => isBiometricEnabled(ctx, args.projectId) });

/** Store a device-resident template atomically without granting access to its source. */
const sourceArgs = { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), userId: v.id("users"), expectedCardNumber: v.string(), encData: v.string(), iv: v.string(), keyVersion: v.string() };
type SourceArgs = import("convex/values").ObjectType<typeof sourceArgs>;
async function storeSource(ctx: MutationCtx, args: SourceArgs): Promise<void> {
    validateFingerNo(args.fingerNo);
    const employee = await ctx.db.get(args.employeeId);
    const device = await ctx.db.get(args.deviceId);
    const user = await ctx.db.get(args.userId);
    const employeeNo = employee ? hikPersonIdentity(employee) : undefined;
    if (!user || !employee || !employeeNo || !device || employee.projectId !== device.projectId || employeeNo !== args.expectedCardNumber || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex) throw new Error("Kişi bilgileri değişti");
    if (!isProjectAllowed(await getProjectIdsForUser({ ...ctx, user }), employee.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    for (const permission of ["devices.manage", "employees.manage", "biometrics.manage"] as const) await requirePermission(ctx, user, employee.projectId, permission);
    await assertBiometricAllowed(ctx, employee.projectId);
    const templates = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", args.employeeId)).take(11);
    if (templates.some(template => template.fingerPrintID === args.fingerNo)) return;
    if (templates.length >= MAX_FINGERPRINTS_PER_EMPLOYEE) throw new Error("Parmak izi sınırı aşıldı");
    const existing = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId).eq("fingerNo", args.fingerNo)).unique();
    if (existing?.attemptId || existing?.deletionEmployeeNo !== undefined) throw new Error("Cihazda işlem sürüyor");
    const value = { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employeeNo, enrolledBy: user._id };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("deviceFingerprintEnrollments", value);
    await ctx.db.insert("employeeFingerprints", { employeeId: args.employeeId, projectId: employee.projectId, fingerPrintID: args.fingerNo, encData: args.encData, iv: args.iv, keyVersion: args.keyVersion, sourceDeviceId: args.deviceId, enrolledBy: args.userId, addedAt: Date.now() });
}
export const recordSource = internalMutation({ args: sourceArgs, handler: storeSource });
export const recordSources = internalMutation({
  args: { sources: v.array(v.object(sourceArgs)) },
  handler: async (ctx, args): Promise<void> => {
    if (args.sources.length > 50) throw new Error("Bir sayfada en fazla 50 parmak izi aktarılabilir");
    for (const source of args.sources) await storeSource(ctx, source);
  },
});

export const scheduleSync = internalMutation({
  args: { employeeId: v.id("employees"), ruleId: v.optional(v.id("accessRules")) },
  handler: async (ctx, args): Promise<void> => {
    if (!args.ruleId) return;
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: args.ruleId });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: args.employeeId });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: args.employeeId });
  },
});
