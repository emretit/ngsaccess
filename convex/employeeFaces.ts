import { ConvexError, v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Çalışana ait yüz fotoğraf kaydı (tek kişi = tek yüz). Convex storage'a yüklenir,
 * `pictureStorageId` referansı tutulur. Eklenince ilgili Hikvision cihazlara
 * scheduler ile sync tetiklenir.
 */

/**
 * Internal: yüz storage ref'ini çalışan için döner — action'lar bytes'ı sonra çeker.
 */
export const getStorageRef = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const face = await ctx.db
      .query("employeeFaces")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
    if (!face) return null;
    // Missing consent preserves legacy behavior; a new grant supersedes a withdrawal.
    let recorded = false;
    let granted = false;
    for await (const consent of ctx.db.query("employeeConsents")
      .withIndex("by_employee_type", q => q.eq("employeeId", args.employeeId).eq("consentType", "biometric_face"))) {
      recorded = true;
      if (!consent.revokedAt) { granted = true; break; }
    }
    if (recorded && !granted) throw new ConvexError("Yüz tanıma rızası iptal edilmiş. Yüz eklemek için yeniden rıza alın.");
    return {
      _id: face._id,
      pictureStorageId: face.pictureStorageId,
      projectId: face.projectId,
    };
  },
});

