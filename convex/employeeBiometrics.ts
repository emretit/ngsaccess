import { resolveProjectScope } from "./lib/projectScope";
import { getProjectIdsWithPermission } from "./lib/permissions";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";

/**
 * Kişiler tablosu "Biyometrik" kolonu: kişide yüz / parmak izi kaydı var mı.
 * Yalnız varlık + kayıtlı parmak numaraları döner; şablon ya da fotoğraf referansı dönmez.
 * Yönetici değilse boş liste (kolon gizlenir).
 */
export const summary = authedQuery({
  args: { projectId: v.optional(v.id("projects")), employeeIds: v.array(v.id("employees")) },
  returns: v.array(v.object({
    employeeId: v.id("employees"),
    face: v.boolean(),
    fingerNos: v.array(v.number()),
  })),
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const allowed = await getProjectIdsWithPermission(ctx, ctx.user, "biometrics.manage");
    const projectIds = args.projectId ? allowed.filter(id => id === args.projectId) : allowed;
    const employeeIds = [...new Set(args.employeeIds)];
    if (employeeIds.length > 100) throw new Error("Biyometri özeti en fazla 100 görünür kişi için alınabilir");
    const byEmployee = new Map<Id<"employees">, { face: boolean; fingerNos: number[] }>();
    const entry = (employeeId: Id<"employees">) => {
      let current = byEmployee.get(employeeId);
      if (!current) byEmployee.set(employeeId, current = { face: false, fingerNos: [] });
      return current;
    };
    for (const employeeId of employeeIds) {
      const employee = await ctx.db.get(employeeId);
      if (!employee?.projectId || !projectIds.includes(employee.projectId) || employee.isVisitor) continue;
      const [faces, fingerprints] = await Promise.all([
        ctx.db.query("employeeFaces").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(1),
        ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(11),
      ]);
      if (fingerprints.length > 10) throw new Error("Kişinin parmak izi sayısı beklenen sınırı aşıyor");
      for (const face of faces) if (face.projectId === employee.projectId) entry(face.employeeId).face = true;
      for (const fingerprint of fingerprints) if (fingerprint.projectId === employee.projectId) entry(fingerprint.employeeId).fingerNos.push(fingerprint.fingerPrintID);
    }
    return [...byEmployee].map(([employeeId, value]) => ({ employeeId, face: value.face, fingerNos: value.fingerNos.sort((a, b) => a - b) }));
  },
});
