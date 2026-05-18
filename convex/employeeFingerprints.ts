import { v } from "convex/values";
import { api } from "./_generated/api";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { internalQuery } from "./_generated/server";

/**
 * Çalışan başına 1-10 parmak izi slotu. `fingerData` cihazdan canlı capture
 * edilen base64 şablon (cihaz-modeline özgü, başka modele aktarılamaz).
 */

const MAX_SLOTS = 10;

export const listByEmployee = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return [];
    if (
      employee.projectId &&
      ctx.user.role !== "super_admin" &&
      !isProjectAllowed(allowedProjectIds, employee.projectId)
    ) {
      return [];
    }
    const rows = await ctx.db
      .query("employeeFingerprints")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    return rows
      .map((r) => ({
        _id: r._id,
        fingerPrintID: r.fingerPrintID,
        fingerType: r.fingerType,
        addedAt: r.addedAt,
        // fingerData burada DÖNMEZ — base64 template büyük + lazımsa worker okur
      }))
      .sort((a, b) => a.fingerPrintID - b.fingerPrintID);
  },
});

export const addFingerprint = authedMutation({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
    fingerData: v.string(),
    fingerType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.fingerPrintID < 1 || args.fingerPrintID > MAX_SLOTS) {
      throw new Error(`fingerPrintID 1-${MAX_SLOTS} arasında olmalı`);
    }
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Çalışan bulunamadı");
    if (
      employee.projectId &&
      ctx.user.role !== "super_admin" &&
      !isProjectAllowed(allowedProjectIds, employee.projectId)
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }

    // KVKK 6698 — özel nitelikli (biyometrik) veri için açık rıza zorunlu
    const consents = await ctx.db
      .query("employeeConsents")
      .withIndex("by_employee_type", (q) =>
        q.eq("employeeId", args.employeeId).eq("consentType", "biometric_fingerprint"),
      )
      .collect();
    if (!consents.some((c) => !c.revokedAt)) {
      throw new Error(
        "KVKK rıza kaydı bulunmadan biyometrik (parmak izi) veri eklenemez. Önce çalışandan açık rıza alın.",
      );
    }

    // Aynı slot varsa replace
    const existing = await ctx.db
      .query("employeeFingerprints")
      .withIndex("by_employee_fingerprint", (q) =>
        q.eq("employeeId", args.employeeId).eq("fingerPrintID", args.fingerPrintID),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        fingerData: args.fingerData,
        fingerType: args.fingerType,
        addedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("employeeFingerprints", {
        employeeId: args.employeeId,
        projectId: employee.projectId,
        fingerPrintID: args.fingerPrintID,
        fingerData: args.fingerData,
        fingerType: args.fingerType,
        addedAt: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeFingerprintToDevices, {
      employeeId: args.employeeId,
      fingerPrintID: args.fingerPrintID,
    });
  },
});

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

export const removeFingerprint = authedMutation({
  args: {
    employeeId: v.id("employees"),
    fingerPrintID: v.number(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return;
    if (
      employee.projectId &&
      ctx.user.role !== "super_admin" &&
      !isProjectAllowed(allowedProjectIds, employee.projectId)
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    const row = await ctx.db
      .query("employeeFingerprints")
      .withIndex("by_employee_fingerprint", (q) =>
        q.eq("employeeId", args.employeeId).eq("fingerPrintID", args.fingerPrintID),
      )
      .first();
    if (!row) return;
    await ctx.db.delete(row._id);
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.deleteEmployeeFingerprintFromDevices, {
      employeeId: args.employeeId,
      fingerPrintID: args.fingerPrintID,
    });
  },
});
