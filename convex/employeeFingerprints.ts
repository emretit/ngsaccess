import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Çalışan başına 1-10 parmak izi slotu. `fingerData` cihazdan canlı capture
 * edilen base64 şablon (cihaz-modeline özgü, başka modele aktarılamaz).
 */


/**
 * Internal: tek bir fingerprint kaydını döner (cihaz sync action'ı için).
 */
export const getOne = internalQuery({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeFingerprints")
      .withIndex("by_employee_fingerprint", (q) =>
        q.eq("employeeId", args.employeeId).eq("fingerPrintID", args.fingerPrintID),
      )
      .first();
  },
});

