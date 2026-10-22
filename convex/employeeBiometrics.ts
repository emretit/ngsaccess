import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { isManager } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";

/** Proje başına okunan biyometri satırı üst sınırı (kişi başına 1 yüz + en fazla 10 parmak). */
const MAX_ROWS_PER_PROJECT = 5000;

/**
 * Kişiler tablosu "Biyometrik" kolonu: kişide yüz / parmak izi kaydı var mı.
 * Yalnız varlık + kayıtlı parmak numaraları döner; şablon ya da fotoğraf referansı dönmez.
 * Yönetici değilse boş liste (kolon gizlenir).
 */
export const summary = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.array(v.object({
    employeeId: v.id("employees"),
    face: v.boolean(),
    fingerNos: v.array(v.number()),
  })),
  handler: async (ctx, args) => {
    if (!isManager(ctx.user)) return [];
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const byEmployee = new Map<Id<"employees">, { face: boolean; fingerNos: number[] }>();
    const entry = (employeeId: Id<"employees">) => {
      let current = byEmployee.get(employeeId);
      if (!current) byEmployee.set(employeeId, current = { face: false, fingerNos: [] });
      return current;
    };
    for (const projectId of projectIds) {
      const [faces, fingerprints] = await Promise.all([
        ctx.db.query("employeeFaces").withIndex("by_project", q => q.eq("projectId", projectId)).take(MAX_ROWS_PER_PROJECT),
        ctx.db.query("employeeFingerprints").withIndex("by_project", q => q.eq("projectId", projectId)).take(MAX_ROWS_PER_PROJECT),
      ]);
      for (const face of faces) entry(face.employeeId).face = true;
      for (const fingerprint of fingerprints) entry(fingerprint.employeeId).fingerNos.push(fingerprint.fingerPrintID);
    }
    return [...byEmployee].map(([employeeId, value]) => ({ employeeId, face: value.face, fingerNos: value.fingerNos.sort((a, b) => a - b) }));
  },
});
