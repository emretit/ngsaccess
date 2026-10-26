import { requirePermission } from "./lib/permissions";
import { ConvexError, v } from "convex/values";
import { authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { findDuplicateImportRows, normalizeEmployeeImportName, validateEmployeeImportRow } from "./lib/employeeImportValidation";
import { writeAudit } from "./lib/audit";
import type { Id } from "./_generated/dataModel";
import { scheduleEmployeeCardChange } from "./lib/employeeCardChange";

const rowValidator = v.object({
  rowNumber: v.number(), firstName: v.string(), lastName: v.string(), email: v.string(),
  tcNo: v.optional(v.string()), payrollCode: v.optional(v.string()), cardNumber: v.string(),
  department: v.optional(v.string()), position: v.optional(v.string()), company: v.optional(v.string()), isActive: v.optional(v.boolean()),
});
const fieldLimit = (value: string | undefined, label: string) => {
  if (value && value.length > 256) throw new Error(`${label} en fazla 256 karakter olabilir`);
};
// `employees.ts` findDuplicateEmployee checks cardNumber, email, and tcNo globally.
const duplicateMessages = {
  tcNo: "Bu TC kimlik numarası başka bir personelde kullanılıyor",
  email: "Bu e-posta adresi başka bir personelde kullanılıyor",
  cardNumber: "Bu kart numarası başka bir personelde kullanılıyor",
} as const;

export const importChunk = authedMutation({
  args: { projectId: v.id("projects"), rows: v.array(rowValidator), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    if (args.rows.length > 100) throw new Error("Bir çağrıda en fazla 100 satır içe aktarılabilir");
    const allowed = await getProjectIdsForUser(ctx);
    if (!isProjectAllowed(allowed, args.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    await requirePermission(ctx, ctx.user, args.projectId, "employees.manage");
    const inFileDuplicates = findDuplicateImportRows(args.rows);
    const results: { rowNumber: number; status: "created" | "skippedDuplicate" | "error"; message: string }[] = [];
    const departments = await ctx.db.query("departments").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(500);
    const positions = await ctx.db.query("positions").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(500);
    const companies = await ctx.db.query("companies").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(500);
    for (const row of args.rows) {
      for (const [value, label] of [[row.firstName, "Ad"], [row.lastName, "Soyad"], [row.email, "E-posta"], [row.tcNo, "T.C. Kimlik No"], [row.payrollCode, "Sicil/Bordro Kodu"], [row.cardNumber, "Kart No"], [row.department, "Departman"], [row.position, "Pozisyon"], [row.company, "Firma"]] as const) fieldLimit(value, label);
      const errors = validateEmployeeImportRow(row);
      const fileDuplicate = inFileDuplicates.get(row.rowNumber);
      if (fileDuplicate) errors.push(fileDuplicate);
      const relation = <T extends { name: string }>(items: T[], name: string | undefined, label: string): T | undefined => {
        if (!name?.trim()) return undefined;
        const found = items.find(item => normalizeEmployeeImportName(item.name) === normalizeEmployeeImportName(name));
        if (!found) errors.push(`${label} bu projede bulunamadı`);
        return found;
      };
      const department = relation(departments, row.department, "Departman");
      const position = relation(positions, row.position, "Pozisyon");
      const company = relation(companies, row.company, "Firma");
      if (errors.length) { results.push({ rowNumber: row.rowNumber, status: "error", message: errors.join("; ") }); continue; }
      let duplicateMessage: string | undefined;
      for (const [field, value] of [["tcNo", row.tcNo?.trim()], ["email", row.email], ["cardNumber", row.cardNumber.trim()]] as const) {
        if (!value) continue;
        const matches = ctx.db.query("employees").withIndex(field === "tcNo" ? "by_tc" : field === "email" ? "by_email" : "by_card", q => q.eq(field, value));
        // Other projects may share identifiers; a global take(20) can hide this project's match.
        for await (const _employee of matches) {
          // employees.create tekillik kontrolü projeden bağımsızdır; import da aynı global kapsamı kullanır.
          duplicateMessage = duplicateMessages[field];
          break;
        }
        if (duplicateMessage) break;
      }
      if (duplicateMessage) { results.push({ rowNumber: row.rowNumber, status: "skippedDuplicate", message: duplicateMessage }); continue; }
      if (args.dryRun) { results.push({ rowNumber: row.rowNumber, status: "created", message: "İçe aktarmaya hazır" }); continue; }
      const now = new Date().toISOString();
      await ctx.db.insert("employees", {
        projectId: args.projectId, firstName: row.firstName.trim(), lastName: row.lastName.trim(), email: row.email,
        tcNo: row.tcNo?.trim() || undefined, payrollCode: row.payrollCode?.trim() || undefined, cardNumber: row.cardNumber.trim(),
        departmentId: department?._id,
        positionId: position?._id,
        companyId: company?._id,
        isActive: row.isActive ?? true, createdAt: now, updatedAt: now,
      });
      results.push({ rowNumber: row.rowNumber, status: "created", message: "Kişi oluşturuldu" });
    }
    if (!args.dryRun) {
      await writeAudit(ctx, {
        user: ctx.user, projectId: args.projectId, action: "create", targetTable: "employees",
        targetId: String(args.projectId), note: "Excel içe aktarma",
        newValue: {
          imported: results.filter(result => result.status === "created").length,
          skipped: results.filter(result => result.status === "skippedDuplicate").length,
          errors: results.filter(result => result.status === "error").length,
        },
      });
    }
    return results;
  },
});

export const assignCards = authedMutation({
  args: { assignments: v.array(v.object({ employeeId: v.id("employees"), cardNumber: v.string() })) },
  handler: async (ctx, args) => {
    if (args.assignments.length > 200) throw new Error("Bir çağrıda en fazla 200 kart atanabilir");
    const allowed = await getProjectIdsForUser(ctx);
    const results: { employeeId: string; status: "assigned" | "error"; message: string }[] = [];
    const projectIds = new Set<Id<"projects">>();
    for (const assignment of args.assignments) {
      const cardNumber = assignment.cardNumber.trim();
      const employee = await ctx.db.get(assignment.employeeId);
      if (!employee || !isProjectAllowed(allowed, employee.projectId)) {
        results.push({ employeeId: assignment.employeeId, status: "error", message: "Kişiye erişim yetkiniz yok" });
        continue;
      }
      await requirePermission(ctx, ctx.user, employee.projectId, "employees.manage");
      if (employee.isVisitor === true) throw new ConvexError({
        code: "VISITOR_USE_VISITOR_SCREEN",
        message: "Ziyaretçi kayıtları Ziyaretçiler ekranından yönetilir.",
      });
      if (employee.projectId) projectIds.add(employee.projectId);
      if (!cardNumber || cardNumber.length > 128 || !/^[\w-]+$/.test(cardNumber)) {
        results.push({ employeeId: assignment.employeeId, status: "error", message: "Kart numarası biçimi geçersiz" });
        continue;
      }
      const matches = ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", cardNumber));
      let conflict = false;
      for await (const candidate of matches) {
        if (candidate._id !== employee._id) { conflict = true; break; }
      }
      if (conflict) {
        results.push({ employeeId: assignment.employeeId, status: "error", message: "Kart numarası başka bir kişide kullanılıyor" });
        continue;
      }
      const previousCardNumber = employee.cardNumber;
      const cardChanged = previousCardNumber !== cardNumber;
      await ctx.db.patch(employee._id, { cardNumber, updatedAt: new Date().toISOString() });
      if (cardChanged) await scheduleEmployeeCardChange(ctx, employee._id, employee.projectId, previousCardNumber);
      results.push({ employeeId: assignment.employeeId, status: "assigned", message: "Kart atandı" });
    }
    await writeAudit(ctx, {
      user: ctx.user, projectId: projectIds.size === 1 ? [...projectIds][0] : undefined,
      action: "update", targetTable: "employees", targetId: String(ctx.user._id), note: "Excel kart atama",
      newValue: {
        assigned: results.filter(result => result.status === "assigned").length,
        errors: results.filter(result => result.status === "error").length,
      },
    });
    return results;
  },
});

export const logExport = authedMutation({
  args: { projectId: v.id("projects"), rowCount: v.number() },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.rowCount) || args.rowCount < 0 || args.rowCount > 5000) {
      throw new Error("Dışa aktarma satır sayısı 0 ile 5000 arasında olmalıdır");
    }
    const allowed = await getProjectIdsForUser(ctx);
    if (!isProjectAllowed(allowed, args.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    await requirePermission(ctx, ctx.user, args.projectId, "reports.view");
    await writeAudit(ctx, {
      user: ctx.user, projectId: args.projectId, action: "update", targetTable: "employees",
      targetId: String(args.projectId), newValue: { exported: args.rowCount }, note: "Excel dışa aktarma",
    });
    return null;
  },
});
