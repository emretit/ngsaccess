import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { isManager } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";

/** Proje başına okunan biyometri satırı üst sınırı (kişi başına 1 yüz + en fazla 10 parmak). */
const MAX_ROWS_PER_PROJECT = 5000;

/**
 * Kişiler tablosu "Biyometrik" kolonu: kişide yüz / parmak izi kaydı var mı.
 * Yalnız varlık + parmak sayısı döner; şablon ya da fotoğraf referansı dönmez.
 * Yönetici değilse boş liste (kolon gizlenir).
 */
export const summary = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.array(v.object({
    employeeId: v.id("employees"),
    face: v.boolean(),
    fingerprints: v.number(),
  })),
  handler: async (ctx, args) => {
    if (!isManager(ctx.user)) return [];
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const byEmployee = new Map<Id<"employees">, { face: boolean; fingerprints: number }>();
    const entry = (employeeId: Id<"employees">) => {
      const current = byEmployee.get(employeeId) ?? { face: false, fingerprints: 0 };
      byEmployee.set(employeeId, current);
      return current;
    };
    for (const projectId of projectIds) {
      const [faces, fingerprints] = await Promise.all([
        ctx.db.query("employeeFaces").withIndex("by_project", q => q.eq("projectId", projectId)).take(MAX_ROWS_PER_PROJECT),
        ctx.db.query("employeeFingerprints").withIndex("by_project", q => q.eq("projectId", projectId)).take(MAX_ROWS_PER_PROJECT),
      ]);
      for (const face of faces) entry(face.employeeId).face = true;
      for (const fingerprint of fingerprints) entry(fingerprint.employeeId).fingerprints += 1;
    }
    return [...byEmployee].map(([employeeId, value]) => ({ employeeId, ...value }));
  },
});
