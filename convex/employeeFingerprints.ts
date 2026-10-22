import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { enrollmentTarget, validateFingerNo } from "./fingerprintEnrollment";

/** Encrypted rows are available exclusively to internal actions. */
export const getOne = internalQuery({
  args: { employeeId: v.id("employees"), fingerPrintID: v.number() },
  handler: async (ctx, args) => ctx.db.query("employeeFingerprints").withIndex("by_employee_fingerprint", q => q.eq("employeeId", args.employeeId).eq("fingerPrintID", args.fingerPrintID)).unique(),
});
export const listInternal = internalQuery({
  args: { employeeId: v.id("employees"), fingerNo: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", args.employeeId)).take(11);
    return rows.filter(row => args.fingerNo === undefined || row.fingerPrintID === args.fingerNo);
  },
});
export const upsertEncrypted = internalMutation({
  args: { employeeId: v.id("employees"), fingerNo: v.number(), sourceDeviceId: v.id("devices"), enrolledBy: v.id("users"), expectedCardNumber: v.string(), encData: v.string(), iv: v.string(), keyVersion: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateFingerNo(args.fingerNo);
    const { employee } = await enrollmentTarget(ctx, args.employeeId, args.sourceDeviceId);
    const source = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee_device_finger", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.sourceDeviceId).eq("fingerNo", args.fingerNo)).unique();
    if (employee.cardNumber.trim() !== args.expectedCardNumber.trim() || !source?.enrolledAt || source.deletionEmployeeNo !== undefined) throw new ConvexError("Kişi bilgileri değişti.");
    const existing = await ctx.db.query("employeeFingerprints").withIndex("by_employee_fingerprint", q => q.eq("employeeId", args.employeeId).eq("fingerPrintID", args.fingerNo)).unique();
    const value = { employeeId: args.employeeId, projectId: employee.projectId, fingerPrintID: args.fingerNo, encData: args.encData, iv: args.iv, keyVersion: args.keyVersion, sourceDeviceId: args.sourceDeviceId, enrolledBy: args.enrolledBy, addedAt: Date.now() };
    // A recaptured slot replaces the template: old deliveries are no longer coverage.
    for await (const delivery of ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", args.employeeId))) {
      if (delivery.fingerNo === args.fingerNo && delivery.deviceId !== args.sourceDeviceId && delivery.enrolledAt) await ctx.db.patch(delivery._id, { enrolledAt: "" });
    }
    if (existing) await ctx.db.replace(existing._id, value);
    else await ctx.db.insert("employeeFingerprints", value);
    return null;
  },
});
