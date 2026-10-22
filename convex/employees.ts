import { scheduleFingerprintPurge, scheduleEmployeeCardChange } from "./lib/employeeCardChange";
import { canSeePay, maskPay } from "./lib/payVisibility";
import { claimEmployeePhoto } from "./lib/peoplePhoto";
import { snapshotEmployeeHikDevices } from "./lib/peopleHikSnapshot";
import { employeeRelationsToValidate, validateEmployeeRelations } from "./lib/peopleRelations";
import { resolveProjectScope } from "./lib/projectScope";
import { toPatch } from "./lib/nullablePatch";
import { assertSameProject, validatePay, employeeDependentTables, assertEmployeeBulkDeleteLimit } from "./lib/employeeUx";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authedQuery, adminMutation, adminQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isManager } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { cascadeRemoveEmployeePII } from "./lib/employeeCascade";
import { resolveEmployeeIdeDeviceIds } from "./lib/accessGraph";
import { writeEmployeePassword } from "./lib/employeeAuth";

type DuplicateField = "cardNumber" | "email" | "tcNo";

export async function findDuplicateEmployee(
  ctx: QueryCtx,
  field: DuplicateField,
  value: string,
  excludeId?: Id<"employees">
): Promise<Doc<"employees"> | null> {
  const indexName =
    field === "cardNumber" ? "by_card" : field === "email" ? "by_email" : "by_tc";
  const fieldName =
    field === "cardNumber" ? "cardNumber" : field === "email" ? "email" : "tcNo";

  const existing = await ctx.db
    .query("employees")
    .withIndex(indexName, (q) => q.eq(fieldName, value))
    .collect();

  return existing.find((e) => e._id !== excludeId) ?? null;
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
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    // Ziyaretçiler (isVisitor) Kişiler listesinde görünmez — Ziyaretçiler sekmesinde yönetilir.
    const employees = results.flat().filter((e) => e.isVisitor !== true);

    return await Promise.all(
      employees.map(async (emp) => {
        const department = emp.departmentId
          ? await ctx.db.get(emp.departmentId) as Doc<"departments"> | null
          : null;
        const position = emp.positionId
          ? await ctx.db.get(emp.positionId) as Doc<"positions"> | null
          : null;
        return {
          ...emp,
          terminationReason: isManager(ctx.user) ? emp.terminationReason : undefined,
          sgkExitCode: isManager(ctx.user) ? emp.sgkExitCode : undefined,
          terminatedBy: isManager(ctx.user) ? emp.terminatedBy : undefined,
          hourlyRate: maskPay(emp.hourlyRate, canSeePay(ctx.user)),
          monthlySalary: maskPay(emp.monthlySalary, canSeePay(ctx.user)),
          departments: department
            ? { _id: department._id, name: department.name }
            : null,
          positions: position
            ? { _id: position._id, name: position.name }
            : null,
        };
      })
    );
  },
});

export const listLightForImport = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
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
    return {
      ...emp,
      terminationReason: isManager(ctx.user) ? emp.terminationReason : undefined,
      sgkExitCode: isManager(ctx.user) ? emp.sgkExitCode : undefined,
      terminatedBy: isManager(ctx.user) ? emp.terminatedBy : undefined,
      hourlyRate: maskPay(emp.hourlyRate, canSeePay(ctx.user)),
      monthlySalary: maskPay(emp.monthlySalary, canSeePay(ctx.user)),
    };
  },
});

export const create = adminMutation({
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
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    shift: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (!allowedProjectIds.some((id) => id === args.projectId)) {
        throw new Error("Bu projeye erişim yetkiniz yok");
      }
    }

    for (const field of ["cardNumber", "email", "tcNo"] as const) {
      const value = args[field];
      if (!value) continue;
      const dup = await findDuplicateEmployee(ctx, field, value);
      if (dup) throw new Error(DUPLICATE_MESSAGES[field]);
    }

    if (args.photoUrl && !args.photoStorageId) throw new Error("Fotoğrafı yeniden yükleyin");
    const photo = args.photoStorageId ? await claimEmployeePhoto(ctx, args.photoStorageId, ctx.user._id) : {};
    await validateEmployeeRelations(ctx, args);
    validatePay(args.hourlyRate, args.monthlySalary);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("employees", {
      ...args,
      ...photo,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
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

export const update = adminMutation({
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
    if (
      updates.projectId !== undefined &&
      !allowedProjectIds.some((id) => id === updates.projectId)
    ) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }

    // Sadece DEĞİŞEN alanlar için duplicate kontrol — mevcut çoğaltma kayıtlar
    // başka alanları güncellenirken (örn. pozisyon) bozulmadan saklanır.
    for (const field of ["cardNumber", "email", "tcNo"] as const) {
      const newValue = updates[field];
      if (newValue != null && newValue !== emp[field]) {
        const dup = await findDuplicateEmployee(ctx, field, newValue, employeeId);
        if (dup) throw new Error(DUPLICATE_MESSAGES[field]);
      }
    }

    if (updates.photoUrl && updates.photoUrl !== emp.photoUrl && !updates.photoStorageId) throw new Error("Fotoğrafı yeniden yükleyin");
    const photo = updates.photoStorageId
      ? await claimEmployeePhoto(ctx, updates.photoStorageId, ctx.user._id, employeeId)
      : updates.photoUrl === null || updates.photoStorageId === null
        ? { photoUrl: undefined, photoStorageId: undefined }
        : {};
    await validateEmployeeRelations(ctx, employeeRelationsToValidate(emp, toPatch(updates)));
    validatePay(updates.hourlyRate, updates.monthlySalary);
    const previousHikSnapshot = updates.cardNumber !== undefined && updates.cardNumber !== emp.cardNumber
      ? await snapshotEmployeeHikDevices(ctx, emp) : undefined;
    await ctx.db.patch(employeeId, { ...toPatch(updates), ...photo, updatedAt: new Date().toISOString() });

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

    if (!cardChanged && (activeChanged || groupMemberAdded)) {
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

async function removeEmployeeWithDependencies(ctx: MutationCtx & { user: Doc<"users"> }, emp: Doc<"employees">) {
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
      for (const record of records) await ctx.db.delete(record._id);
    }

    // KVKK cascade: biyometrik veri sil, rıza iptal, cardReadings PII anonimleştir
    await cascadeRemoveEmployeePII(ctx, emp._id);

    await ctx.db.delete(emp._id);
}

export const remove = adminMutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) throw new Error("Çalışan bulunamadı");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      (!emp.projectId && ctx.user.role !== "super_admin") ||
      (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    await removeEmployeeWithDependencies(ctx, emp);
  },
  returns: v.null(),
});

export const bulkDelete = adminMutation({
  args: { employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args) => {
    assertEmployeeBulkDeleteLimit(args.employeeIds.length);
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employees = await Promise.all(
      [...new Set(args.employeeIds)].map((id) => ctx.db.get(id)),
    );
    for (const emp of employees) {
      if (emp && ((!emp.projectId && ctx.user.role !== "super_admin") || (emp.projectId && !allowedProjectIds.some((pid) => pid === emp.projectId)))) {
        throw new Error(`Çalışan ${emp.firstName} ${emp.lastName} için erişim yetkiniz yok`);
      }
    }
    for (const emp of employees.filter((p): p is NonNullable<typeof p> => p !== null)) {
      await removeEmployeeWithDependencies(ctx, emp);
    }
  },
  returns: v.null(),
});

export const bulkUpdateDepartment = adminMutation({
  args: { employeeIds: v.array(v.id("employees")), departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error("Departman bulunamadı");
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
    return await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();
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
      email: args.email,
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
    await writeEmployeePassword(ctx, auth, args.passwordHash);
  },
});

/** Internal: Çalışana projectId atamak için (one-off / migration) */
export const setProjectId = internalMutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
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
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
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
