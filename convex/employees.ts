import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { cascadeRemoveEmployeePII } from "./lib/employeeCascade";

type DuplicateField = "cardNumber" | "email" | "tcNo";

async function findDuplicateEmployee(
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

const DUPLICATE_MESSAGES: Record<DuplicateField, string> = {
  cardNumber: "Bu kart numarası başka bir personelde kullanılıyor",
  email: "Bu e-posta adresi başka bir personelde kullanılıyor",
  tcNo: "Bu TC kimlik numarası başka bir personelde kullanılıyor",
};

// Form add-only: dropdown sadece eklemek için; var olan diğer kuralları silmez
// (Erişim Yönetimi sayfası bunun için). Returns true if a new row was inserted.
async function upsertGroupMembership(
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
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let employees;
    if (args.isSuperAdmin && ctx.user.role === "super_admin") {
      employees = await ctx.db.query("employees").order("desc").collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("employees")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      employees = results.flat();
    } else {
      return [];
    }

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

export const listLightForImport = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employees =
      ctx.user.role === "super_admin"
        ? await ctx.db.query("employees").collect()
        : (
            await Promise.all(
              allowedProjectIds.map((pid) =>
                ctx.db
                  .query("employees")
                  .withIndex("by_project", (q) => q.eq("projectId", pid))
                  .collect(),
              ),
            )
          ).flat();
    return employees.map((e) => ({
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
    return emp;
  },
});

export const checkDuplicate = authedQuery({
  args: {
    tcNo: v.optional(v.string()),
    cardNumber: v.string(),
    email: v.string(),
    excludeId: v.optional(v.id("employees")),
  },
  handler: async (ctx, args) => {
    const checks: DuplicateField[] = ["cardNumber", "email", "tcNo"];
    for (const field of checks) {
      const value =
        field === "cardNumber" ? args.cardNumber : field === "email" ? args.email : args.tcNo;
      if (!value) continue;
      const dup = await findDuplicateEmployee(ctx, field, value, args.excludeId);
      if (dup) return { field, duplicate: true as const };
    }
    return { duplicate: false as const };
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

    const now = new Date().toISOString();
    const id = await ctx.db.insert("employees", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await upsertGroupMembership(ctx, id, args.accessRuleId, args.projectId);
    // DB import gibi UI dışı insert akışlarında da push tetiklensin diye burada (idempotent).
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
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
    tcNo: v.optional(v.string()),
    cardNumber: v.optional(v.string()),
    payrollCode: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    companyId: v.optional(v.id("companies")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    accessRuleId: v.optional(v.id("accessRules")),
    photoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    shift: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
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
      if (newValue !== undefined && newValue !== emp[field]) {
        const dup = await findDuplicateEmployee(ctx, field, newValue, employeeId);
        if (dup) throw new Error(DUPLICATE_MESSAGES[field]);
      }
    }

    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(employeeId, clean);

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
    if (cardChanged || activeChanged || groupMemberAdded) {
      await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeToDevices, {
        employeeId,
      });
    }
    return employeeId;
  },
  returns: v.id("employees"),
});

export const remove = adminMutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) throw new Error("Çalışan bulunamadı");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      emp.projectId &&
      !allowedProjectIds.some((id) => id === emp.projectId)
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    // Önce cihazlardan sil (employeeId bilgisi gerektiği için DB silinmeden çağrılır).
    await ctx.scheduler.runAfter(
      0,
      api.actions.hikvisionSync.deleteEmployeeFromDevices,
      { employeeId: args.employeeId },
    );

    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", emp.projectId).eq("employeeId", args.employeeId),
      )
      .collect();
    await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));

    const employeeAuth = await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    await Promise.all(employeeAuth.map((ea) => ctx.db.delete(ea._id)));

    const employeeSessions = await ctx.db
      .query("employeeSessions")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    await Promise.all(employeeSessions.map((s) => ctx.db.delete(s._id)));

    const shiftAssignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    await Promise.all(shiftAssignments.map((a) => ctx.db.delete(a._id)));

    // KVKK cascade: biyometrik veri sil, rıza iptal, cardReadings PII anonimleştir
    await cascadeRemoveEmployeePII(ctx, args.employeeId);

    await ctx.db.delete(args.employeeId);
  },
  returns: v.null(),
});

export const bulkDelete = adminMutation({
  args: { employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employees = await Promise.all(
      args.employeeIds.map((id) => ctx.db.get(id)),
    );
    for (const emp of employees) {
      if (emp && emp.projectId && !allowedProjectIds.some((pid) => pid === emp.projectId)) {
        throw new Error(`Çalışan ${emp.firstName} ${emp.lastName} için erişim yetkiniz yok`);
      }
    }
    await Promise.all(
      employees.map(async (emp, idx) => {
        const id = args.employeeIds[idx];
        const groupMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_project_employee", (q) =>
            q.eq("projectId", emp?.projectId).eq("employeeId", id),
          )
          .collect();
        await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));
        const shiftAssignments = await ctx.db
          .query("shiftAssignments")
          .withIndex("by_employee", (q) => q.eq("employeeId", id))
          .collect();
        await Promise.all(shiftAssignments.map((a) => ctx.db.delete(a._id)));
        await cascadeRemoveEmployeePII(ctx, id);
        await ctx.db.delete(id);
      })
    );
  },
  returns: v.null(),
});

export const bulkUpdateStatus = adminMutation({
  args: {
    employeeIds: v.array(v.id("employees")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    for (const id of args.employeeIds) {
      const emp = await ctx.db.get(id);
      if (emp && emp.projectId && !allowedProjectIds.some((pid) => pid === emp.projectId)) {
        throw new Error(`Çalışan ${emp.firstName} ${emp.lastName} için erişim yetkiniz yok`);
      }
    }
    const now = new Date().toISOString();
    await Promise.all(
      args.employeeIds.map((id) =>
        ctx.db.patch(id, { isActive: args.isActive, updatedAt: now })
      )
    );
  },
  returns: v.null(),
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
    await ctx.db.patch(args.authId, {
      passwordHash: args.passwordHash,
      setupToken: undefined,
      tokenExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    });
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
