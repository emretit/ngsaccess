import { syncPlanRefs } from "./lib/shiftAssign";
import { writeAudit } from "./lib/audit";
import { toUtcISO, trDateKey, trDayRangeISO } from "./lib/trDate";
import { getProjectIdsWithPermission, hasPermission, requirePermission } from "./lib/permissions";
import { scheduleFingerprintPurge, scheduleEmployeeCardChange } from "./lib/employeeCardChange";
import { canSeePayInProject, maskPay } from "./lib/payVisibility";
import { claimEmployeePhoto } from "./lib/peoplePhoto";
import { snapshotEmployeeHikDevices } from "./lib/peopleHikSnapshot";
import { employeeCompanyForDepartment, employeeRelationsToValidate, validateEmployeeRelations } from "./lib/peopleRelations";
import { resolveProjectScope } from "./lib/projectScope";
import { toPatch } from "./lib/nullablePatch";
import { assertSameProject, validatePay, employeeDependentTables, assertEmployeeBulkDeleteLimit } from "./lib/employeeUx";
import { internalMutation, internalQuery } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { cascadeRemoveEmployeePII, deleteUnusedEmployeePhoto } from "./lib/employeeCascade";
import { resolveEmployeeIdeDeviceIds } from "./lib/accessGraph";
import { writeEmployeePassword } from "./lib/employeeAuth";
import { visitorSensitiveFields } from "./lib/visitorStatus";
import { cardConflictMessage, findDuplicateCard } from "./lib/cardIdentity";
import { assertNoEmployeeTransfer } from "./lib/transferGuard";

import { normalizeEmployeeEmail } from "./lib/employeeEmail";
export { normalizeEmployeeEmail };

function assertEmployeeRecord(emp: Doc<"employees">) {
  if (emp.isVisitor === true) throw new ConvexError({
    code: "VISITOR_USE_VISITOR_SCREEN",
    message: "Ziyaretçi kayıtları Ziyaretçiler ekranından yönetilir.",
  });
}

/** Employee form dates are stored at the inclusive start of their Turkey calendar day. */
export function normalizeEmployeeAccessStart(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const iso = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? toUtcISO(value) : undefined;
  if (!iso) throw new Error("Erişim başlangıcı geçerli bir ISO tarih olmalıdır");
  const day = trDateKey(iso);
  return trDayRangeISO(day, day).startISO;
}

type DuplicateField = "cardNumber" | "email" | "tcNo";

export async function findDuplicateEmployee(
  ctx: QueryCtx,
  field: DuplicateField,
  value: string,
  excludeId?: Id<"employees">
): Promise<Doc<"employees"> | null> {
  if (field === "cardNumber") return findDuplicateCard(ctx, value, excludeId);
  const normalizedValue = field === "email" ? normalizeEmployeeEmail(value) ?? "" : value;
  if (!normalizedValue) return null;
  const candidates = field === "email" ? [...new Set([normalizedValue, value.trim()])] : [value];
  for (const candidate of candidates) {
    const matches = ctx.db.query("employees")
      .withIndex(field === "email" ? "by_email" : "by_tc", q => q.eq(field, candidate));
    for await (const employee of matches) {
      if (employee._id !== excludeId) return employee;
    }
  }
  return null;
}

export const DUPLICATE_MESSAGES: Record<DuplicateField, string> = {
  cardNumber: "Bu kart numarası başka bir personelde kullanılıyor",
  email: "Bu e-posta adresi başka bir personelde kullanılıyor",
  tcNo: "Bu TC kimlik numarası başka bir personelde kullanılıyor",
};

// IDE panel çözümleme (resolveEmployeeIdeDeviceIds) lib/accessGraph.ts'e taşındı —
// accessRules.ts (removeGroupMember orphan temizliği) ile paylaşılır.

// Form add-only: dropdown sadece eklemek için; var olan diğer kuralları silmez
// (Erişim Yönetimi sayfası bunun için). Returns true if a new row was inserted.
export async function upsertGroupMembership(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  accessRuleId: Id<"accessRules"> | undefined,
  projectId: Id<"projects"> | undefined,
): Promise<boolean> {
  if (!accessRuleId) return false;
  const existing = await ctx.db
    .query("groupMembers")
    .withIndex("by_project_employee", (q) =>
      q.eq("projectId", projectId).eq("employeeId", employeeId),
    )
    .filter((q) => q.eq(q.field("groupId"), accessRuleId))
    .first();
  if (existing) return false;
  await ctx.db.insert("groupMembers", {
    groupId: accessRuleId,
    employeeId,
    projectId,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const allowed = await getProjectIdsWithPermission(ctx, ctx.user, "employees.view");
    const projectIds = args.projectId ? allowed.filter(id => id === args.projectId) : allowed;
    const permissionsByProject = new Map(await Promise.all(projectIds.map(async projectId => {
      const [canManage, canSeePay] = await Promise.all([
        hasPermission(ctx, ctx.user, projectId, "employees.manage"),
        canSeePayInProject(ctx, ctx.user, projectId),
      ]);
      return [projectId, { canManage, canSeePay }] as const;
    })));
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    // Ziyaretçiler (isVisitor) Kişiler listesinde görünmez — Ziyaretçiler sekmesinde yönetilir.
    const employees = results.flat().filter((e) => e.isVisitor !== true);

    return await Promise.all(
      employees.map(async (emp) => {
        const permissions = emp.projectId ? permissionsByProject.get(emp.projectId) : undefined;
        const department = emp.departmentId
          ? await ctx.db.get(emp.departmentId) as Doc<"departments"> | null
          : null;
        const position = emp.positionId
          ? await ctx.db.get(emp.positionId) as Doc<"positions"> | null
          : null;
        // Eski kayıtlarda kişi companyId'si boş olabilir; departmanın şirketi gösterilir.
        const companyId = emp.companyId ?? department?.companyId;
        const company = companyId ? await ctx.db.get(companyId) : null;
        return {
          ...emp,
          terminationReason: permissions?.canManage ? emp.terminationReason : undefined,
          sgkExitCode: permissions?.canManage ? emp.sgkExitCode : undefined,
          terminatedBy: permissions?.canManage ? emp.terminatedBy : undefined,
          hourlyRate: maskPay(emp.hourlyRate, permissions?.canSeePay ?? false),
          monthlySalary: maskPay(emp.monthlySalary, permissions?.canSeePay ?? false),
          departments: department
            ? { _id: department._id, name: department.name }
            : null,
          positions: position
            ? { _id: position._id, name: position.name }
            : null,
          companies: company
            ? { _id: company._id, name: company.name }
            : null,
        };
      })
    );
  },
});

export const listLightForImport = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    await requirePermission(ctx, ctx.user, args.projectId, "employees.manage");
    const employees = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", args.projectId)).collect();
    return employees
      .filter((e) => e.isVisitor !== true)
      .map((e) => ({
        _id: String(e._id),
        tcNo: e.tcNo ?? "",
        firstName: e.firstName,
        lastName: e.lastName,
      }));
  },
});

export const getById = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) return null;
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      emp.projectId &&
      !allowedProjectIds.some((id) => id === emp.projectId)
    ) {
      return null;
    }
    if (!emp.projectId && ctx.user.role !== "super_admin") {
      return null;
    }
    const canManageVisitor = emp.isVisitor === true
      ? await hasPermission(ctx, ctx.user, emp.projectId, "visitors.manage")
      : false;
    if (emp.isVisitor === true && !canManageVisitor) return null;
    await requirePermission(ctx, ctx.user, emp.projectId, "employees.view");
    const visitorFields = emp.isVisitor === true ? visitorSensitiveFields(emp, canManageVisitor) : undefined;
    return {
      ...emp,
      ...visitorFields,
      tcNo: visitorFields?.tcNo ?? emp.tcNo,
      terminationReason: await hasPermission(ctx, ctx.user, emp.projectId, "employees.manage") ? emp.terminationReason : undefined,
      sgkExitCode: await hasPermission(ctx, ctx.user, emp.projectId, "employees.manage") ? emp.sgkExitCode : undefined,
      terminatedBy: await hasPermission(ctx, ctx.user, emp.projectId, "employees.manage") ? emp.terminatedBy : undefined,
      hourlyRate: maskPay(emp.hourlyRate, await canSeePayInProject(ctx, ctx.user, emp.projectId)),
      monthlySalary: maskPay(emp.monthlySalary, await canSeePayInProject(ctx, ctx.user, emp.projectId)),
    };
  },
});

export const create = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    tcNo: v.optional(v.string()),
    cardNumber: v.string(),
    payrollCode: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    companyId: v.optional(v.id("companies")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    accessRuleId: v.optional(v.id("accessRules")),
    photoUrl: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    accessStartsAt: v.optional(v.union(v.string(), v.null())),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    shift: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "employees.manage");
    if (args.accessRuleId !== undefined) await requirePermission(ctx, ctx.user, args.projectId, "accessRules.manage");
    if (args.hourlyRate !== undefined || args.monthlySalary !== undefined) await requirePermission(ctx, ctx.user, args.projectId, "pay.view");
    if (args.projectId) {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (!allowedProjectIds.some((id) => id === args.projectId)) {
        throw new Error("Bu projeye erişim yetkiniz yok");
      }
    }

    for (const field of ["cardNumber", "email", "tcNo"] as const) {
      const value = field === "email" ? normalizeEmployeeEmail(args.email) : args[field];
      if (!value) continue;
      const dup = await findDuplicateEmployee(ctx, field, value);
      if (dup) throw new Error(field === "cardNumber" ? cardConflictMessage(value, dup, DUPLICATE_MESSAGES[field]) : DUPLICATE_MESSAGES[field]);
    }

    if (args.photoUrl && !args.photoStorageId) throw new Error("Fotoğrafı yeniden yükleyin");
    const photo = args.photoStorageId ? await claimEmployeePhoto(ctx, args.photoStorageId, ctx.user._id) : {};
    await validateEmployeeRelations(ctx, args);
    const companyId = await employeeCompanyForDepartment(ctx, args.departmentId, args.companyId, args.companyId !== undefined);
    validatePay(args.hourlyRate, args.monthlySalary);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("employees", {
      ...args,
      companyId,
      email: normalizeEmployeeEmail(args.email) ?? "",
      ...photo,
      accessStartsAt: normalizeEmployeeAccessStart(args.accessStartsAt),
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    if (args.accessStartsAt != null) await writeAudit(ctx, {
      user: ctx.user, projectId: args.projectId, action: "create", targetTable: "employees",
      targetId: id, newValue: { accessStartsAt: normalizeEmployeeAccessStart(args.accessStartsAt) }, note: "Erişim başlangıcı",
    });
    await upsertGroupMembership(ctx, id, args.accessRuleId, args.projectId);
    // DB import gibi UI dışı insert akışlarında da push tetiklensin diye burada (idempotent).
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
      employeeId: id,
    });
    // IDE Smart panellerine de otomatik push (MQTT kuyruğu üzerinden). internalAction:
    // scheduler context'inde auth identity yok, authedAction throw ederdi.
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
      employeeId: id,
    });
    return id;
  },
  returns: v.id("employees"),
});

export const update = authedMutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    tcNo: v.optional(v.union(v.null(), v.string())),
    cardNumber: v.optional(v.string()),
    payrollCode: v.optional(v.union(v.null(), v.string())),
    departmentId: v.optional(v.union(v.null(), v.id("departments"))),
    companyId: v.optional(v.union(v.null(), v.id("companies"))),
    positionId: v.optional(v.union(v.null(), v.id("positions"))),
    shiftId: v.optional(v.union(v.null(), v.id("shifts"))),
    accessRuleId: v.optional(v.id("accessRules")),
    photoUrl: v.optional(v.union(v.null(), v.string())),
    photoStorageId: v.optional(v.union(v.null(), v.id("_storage"))),
    accessStartsAt: v.optional(v.union(v.string(), v.null())),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.union(v.null(), v.string())),
    shift: v.optional(v.union(v.null(), v.string())),
    hourlyRate: v.optional(v.union(v.null(), v.number())),
    monthlySalary: v.optional(v.union(v.null(), v.number())),
  },
  handler: async (ctx, args) => {
    const { employeeId, ...updates } = args;
    const emp = await ctx.db.get(employeeId);
    if (!emp) throw new Error("Çalışan bulunamadı");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      emp.projectId &&
      !allowedProjectIds.some((id) => id === emp.projectId)
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    await requirePermission(ctx, ctx.user, emp.projectId, "employees.manage");
    assertEmployeeRecord(emp);
    if ((updates.cardNumber !== undefined && updates.cardNumber !== emp.cardNumber) ||
        (updates.projectId !== undefined && updates.projectId !== emp.projectId) ||
        (updates.isActive !== undefined && updates.isActive !== emp.isActive)) await assertNoEmployeeTransfer(ctx, employeeId);
    if (updates.projectId !== undefined && updates.projectId !== emp.projectId) throw new ConvexError({
      code: "EMPLOYEE_PROJECT_MOVE_UNSUPPORTED",
      message: "Projeyi değiştirmek için Kişi Ayrıntıları → Başka projeye taşı yolunu kullanın.",
    });
    if (updates.accessRuleId !== undefined) await requirePermission(ctx, ctx.user, emp.projectId, "accessRules.manage");
    const accessStartsAt = updates.accessStartsAt === undefined ? emp.accessStartsAt : normalizeEmployeeAccessStart(updates.accessStartsAt);
    const accessStartChanged = accessStartsAt !== emp.accessStartsAt;
    if (updates.accessStartsAt !== undefined) updates.accessStartsAt = accessStartsAt ?? null;
    if (updates.hourlyRate !== undefined || updates.monthlySalary !== undefined) {
      await requirePermission(ctx, ctx.user, emp.projectId, "pay.view");
      if (updates.projectId !== undefined) await requirePermission(ctx, ctx.user, updates.projectId, "pay.view");
    }
    // Taşıma ücreti hedef projede görünür kılar: kaynakta pay.view'si olmayan kişi ücreti taşıyarak okuyamasın.
    if (updates.projectId !== undefined && updates.projectId !== emp.projectId && (emp.hourlyRate != null || emp.monthlySalary != null)) {
      await requirePermission(ctx, ctx.user, emp.projectId, "pay.view");
    }
    if (updates.projectId !== undefined) await requirePermission(ctx, ctx.user, updates.projectId, "employees.manage");
    if (
      updates.projectId !== undefined &&
      !allowedProjectIds.some((id) => id === updates.projectId)
    ) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }

    if (updates.email !== undefined) updates.email = normalizeEmployeeEmail(updates.email) ?? "";

    // Sadece DEĞİŞEN alanlar için duplicate kontrol — mevcut çoğaltma kayıtlar
    // başka alanları güncellenirken (örn. pozisyon) bozulmadan saklanır.
    for (const field of ["cardNumber", "email", "tcNo"] as const) {
      const newValue = updates[field];
      if (newValue != null && newValue !== emp[field]) {
        const dup = await findDuplicateEmployee(ctx, field, newValue, employeeId);
        if (dup) throw new Error(field === "cardNumber" ? cardConflictMessage(newValue, dup, DUPLICATE_MESSAGES[field]) : DUPLICATE_MESSAGES[field]);
      }
    }

    if (updates.photoUrl && updates.photoUrl !== emp.photoUrl && !updates.photoStorageId) throw new Error("Fotoğrafı yeniden yükleyin");
    const photo = updates.photoStorageId
      ? await claimEmployeePhoto(ctx, updates.photoStorageId, ctx.user._id, employeeId)
      : updates.photoUrl === null || updates.photoStorageId === null
        ? { photoUrl: undefined, photoStorageId: undefined }
        : {};
    await validateEmployeeRelations(ctx, employeeRelationsToValidate(emp, toPatch(updates)));
    if (updates.departmentId !== undefined || updates.companyId !== undefined) {
      const departmentId = updates.departmentId === undefined ? emp.departmentId : updates.departmentId;
      const companyId = updates.companyId === undefined ? emp.companyId : updates.companyId;
      updates.companyId = await employeeCompanyForDepartment(ctx, departmentId, companyId, updates.companyId !== undefined) ?? null;
    }
    validatePay(updates.hourlyRate, updates.monthlySalary);
    const previousHikSnapshot = updates.cardNumber !== undefined && updates.cardNumber !== emp.cardNumber
      ? await snapshotEmployeeHikDevices(ctx, emp) : undefined;
    await ctx.db.patch(employeeId, { ...toPatch(updates), ...photo, updatedAt: new Date().toISOString() });
    if (emp.photoStorageId && (updates.photoStorageId !== undefined || updates.photoUrl === null)) {
      await deleteUnusedEmployeePhoto(ctx, emp.photoStorageId);
    }

    if (accessStartChanged) await writeAudit(ctx, {
      user: ctx.user, projectId: emp.projectId, action: "update", targetTable: "employees",
      targetId: employeeId, oldValue: { accessStartsAt: emp.accessStartsAt ?? null },
      newValue: { accessStartsAt: accessStartsAt ?? null }, note: "Erişim başlangıcı",
    });
    const groupMemberAdded = await upsertGroupMembership(
      ctx,
      employeeId,
      updates.accessRuleId,
      emp.projectId,
    );

    const cardChanged =
      updates.cardNumber !== undefined && updates.cardNumber !== emp.cardNumber;
    const activeChanged =
      updates.isActive !== undefined && updates.isActive !== emp.isActive;
    if (activeChanged && updates.isActive === false) await scheduleFingerprintPurge(ctx, employeeId, emp.cardNumber, { deleteTemplates: true });
    if (emp.employmentEndDate && updates.isActive === true && emp.isActive !== true) {
      throw new Error("İşten ayrılan kişiyi aktifleştirmek için 'Geri al' kullanın.");
    }

    // Kart no değiştiyse ESKİ kartı IDE panellerinden sök (yoksa orphan kalır → eski
    // kart hâlâ kapı açar). Paneller groupMembers'tan çözülür (kart değişiminden bağımsız);
    // eski değer (emp.cardNumber) ile, yeni kartı yazacak sync'ten ÖNCE enqueue edilir.
    // Eski kart temizliği yetki kaldırması değildir: employeeId taşımaz.
    if (cardChanged) await scheduleEmployeeCardChange(ctx, employeeId, emp.projectId, emp.cardNumber, previousHikSnapshot);

    if (!cardChanged && (activeChanged || groupMemberAdded || accessStartChanged)) {
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
        employeeId,
      });
      await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
        employeeId,
      });
    }
    return employeeId;
  },
  returns: v.id("employees"),
});

export async function removeEmployeeRecord(ctx: MutationCtx, emp: Doc<"employees">, actor: Doc<"users">) {
    await assertNoEmployeeTransfer(ctx, emp._id);
    const snapshot = await snapshotEmployeeHikDevices(ctx, emp);
    await ctx.scheduler.runAfter(
      0,
      internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal,
      { employeeId: emp._id, snapshot },
    );
    // IDE: kayıt + groupMembers birazdan silinecek → getEmployeeWithDevices null döner.
    // Panelleri ŞİMDİ (commit öncesi) çöz, kart no'yu açıkça geçir.
    const ideDeviceIds = await resolveEmployeeIdeDeviceIds(
      ctx,
      emp._id,
      emp.projectId,
    );
    if (ideDeviceIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
        { employeeId: emp._id, cardNumber: emp.cardNumber, deviceIds: ideDeviceIds, projectId: emp.projectId },
      );
    }

    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", emp.projectId).eq("employeeId", emp._id),
      )
      .collect();
    await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));

    for (const table of employeeDependentTables) {
      const records = await ctx.db.query(table).withIndex("by_employee", q => q.eq("employeeId", emp._id)).collect();
      for (const record of records) {
        if ("shiftId" in record) await syncPlanRefs(ctx, { assignmentId: record._id }, record.projectId);
        await ctx.db.delete(record._id);
      }
    }

    // KVKK cascade: biyometrik veri sil, rıza iptal, cardReadings PII anonimleştir
    await cascadeRemoveEmployeePII({ ...ctx, user: actor }, emp._id);

    await ctx.db.delete(emp._id);
}

export const remove = authedMutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) throw new Error("Çalışan bulunamadı");
    await requirePermission(ctx, ctx.user, emp.projectId, "employees.manage");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      (!emp.projectId && ctx.user.role !== "super_admin") ||
      (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    assertEmployeeRecord(emp);
    await removeEmployeeRecord(ctx, emp, ctx.user);
  },
  returns: v.null(),
});

export const bulkDelete = authedMutation({
  args: { employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args) => {
    assertEmployeeBulkDeleteLimit(args.employeeIds.length);
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employees = await Promise.all(
      [...new Set(args.employeeIds)].map((id) => ctx.db.get(id)),
    );
    for (const emp of employees) {
      if (emp) await requirePermission(ctx, ctx.user, emp.projectId, "employees.manage");
      if (emp && ((!emp.projectId && ctx.user.role !== "super_admin") || (emp.projectId && !allowedProjectIds.some((pid) => pid === emp.projectId)))) {
        throw new Error(`Çalışan ${emp.firstName} ${emp.lastName} için erişim yetkiniz yok`);
      }
      if (emp) assertEmployeeRecord(emp);
    }
    for (const emp of employees.filter((p): p is NonNullable<typeof p> => p !== null)) {
      await removeEmployeeRecord(ctx, emp, ctx.user);
    }
  },
  returns: v.null(),
});

export const bulkUpdateDepartment = authedMutation({
  args: { employeeIds: v.array(v.id("employees")), departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error("Departman bulunamadı");
    await requirePermission(ctx, ctx.user, dept.projectId, "employees.manage");
    const allowed = await resolveProjectScope(ctx, dept.projectId);
    const employees = await Promise.all([...new Set(args.employeeIds)].map(id => ctx.db.get(id)));
    for (const emp of employees) {
      if (!emp) throw new Error("Çalışan bulunamadı; hiçbir kayıt değiştirilmedi");
      if (!emp.projectId || !allowed.includes(emp.projectId)) throw new Error("Bu çalışana erişim yetkiniz yok");
      assertSameProject(emp.projectId, dept.projectId);
    }
    for (const emp of employees) {
      if (emp) await ctx.db.patch(emp._id, { departmentId: dept._id, updatedAt: new Date().toISOString() });
    }
    return { updatedCount: employees.length };
  },
});

/** Internal: Email ile çalışanı bulur (admin script'ler için) */
export const getByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmployeeEmail(args.email) ?? "";
    const employee = await ctx.db.query("employees").withIndex("by_email", q => q.eq("email", email)).first();
    if (employee?.terminationType !== "transfer") return employee;
    const candidates = await ctx.db.query("employees").withIndex("by_email", q => q.eq("email", email)).order("desc").take(101);
    return candidates.find(row => row.isActive === true && row.terminationType !== "transfer") ?? candidates.find(row => row.terminationType !== "transfer") ?? employee;
  },
});

/** Internal: employeeAuth setup için authId getter (admin script'ler için) */
export const getAuthByEmployeeInternal = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
  },
});

/** Internal: employeeAuth oluştur (admin script'ler için) */
export const createAuthInternal = internalMutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    email: v.optional(v.string()),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("employeeAuth", {
      employeeId: args.employeeId,
      projectId: args.projectId,
      email: normalizeEmployeeEmail(args.email),
      passwordHash: args.passwordHash,
      passwordVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Internal: employeeAuth.passwordHash güncelle (admin script'ler için) */
export const updateAuthPasswordInternal = internalMutation({
  args: {
    authId: v.id("employeeAuth"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.db.get(args.authId);
    if (!auth) throw new Error("Çalışan kimlik kaydı bulunamadı");
    await writeEmployeePassword(ctx, auth, args.passwordHash, { email: normalizeEmployeeEmail(auth.email) });
  },
});

/** Internal: Çalışana projectId atamak için (one-off / migration) */
export const setProjectId = internalMutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await assertNoEmployeeTransfer(ctx, args.employeeId);
    await ctx.db.patch(args.employeeId, {
      projectId: args.projectId,
      updatedAt: new Date().toISOString(),
    });
    return args.employeeId;
  },
});

/** Dev/admin: email ile employee + auth durumunu tek seferde getir. */
export const adminInspectByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      employee: v.object({
        _id: v.id("employees"),
        firstName: v.string(),
        lastName: v.string(),
        email: v.string(),
        cardNumber: v.string(),
        isActive: v.optional(v.boolean()),
      }),
      auth: v.union(
        v.object({
          _id: v.id("employeeAuth"),
          hasPassword: v.boolean(),
          hasSetupToken: v.boolean(),
          tokenExpiresAt: v.union(v.string(), v.null()),
          lastLogin: v.union(v.string(), v.null()),
        }),
        v.null(),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmployeeEmail(args.email) ?? ""))
      .first();
    if (!employee) return null;
    const auth = await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .first();
    return {
      employee: {
        _id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        cardNumber: employee.cardNumber,
        isActive: employee.isActive,
      },
      auth: auth
        ? {
            _id: auth._id,
            hasPassword: !!auth.passwordHash,
            hasSetupToken: !!auth.setupToken,
            tokenExpiresAt: auth.tokenExpiresAt ?? null,
            lastLogin: auth.lastLogin ?? null,
          }
        : null,
    };
  },
});
