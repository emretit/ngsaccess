import { v } from "convex/values";
import { api } from "./_generated/api";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { internalQuery } from "./_generated/server";

/**
 * Çalışana ait yüz fotoğraf kaydı (tek kişi = tek yüz). Convex storage'a yüklenir,
 * `pictureStorageId` referansı tutulur. Eklenince ilgili Hikvision cihazlara
 * scheduler ile sync tetiklenir.
 */

export const getByEmployee = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return null;
    if (
      employee.projectId &&
      ctx.user.role !== "super_admin" &&
      !isProjectAllowed(allowedProjectIds, employee.projectId)
    ) {
      return null;
    }
    const face = await ctx.db
      .query("employeeFaces")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
    if (!face) return null;
    const url = await ctx.storage.getUrl(face.pictureStorageId);
    return {
      _id: face._id,
      pictureUrl: url,
      addedAt: face.addedAt,
    };
  },
});

/**
 * Yüz upload URL'i — frontend bu URL'e doğrudan PUT yapar, storageId döner.
 */
export const generateUploadUrl = authedMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const addFace = authedMutation({
  args: {
    employeeId: v.id("employees"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
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
        q.eq("employeeId", args.employeeId).eq("consentType", "biometric_face"),
      )
      .collect();
    if (!consents.some((c) => !c.revokedAt)) {
      throw new Error(
        "KVKK rıza kaydı bulunmadan biyometrik (yüz) veri eklenemez. Önce çalışandan açık rıza alın.",
      );
    }

    // Mevcut yüzü sil (tek kişi = tek yüz).
    const existing = await ctx.db
      .query("employeeFaces")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
    if (existing) {
      await ctx.storage.delete(existing.pictureStorageId);
      await ctx.db.delete(existing._id);
    }

    const id = await ctx.db.insert("employeeFaces", {
      employeeId: args.employeeId,
      projectId: employee.projectId,
      pictureStorageId: args.storageId,
      addedAt: Date.now(),
    });

    // Hikvision cihazlara push
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.syncEmployeeFaceToDevices, {
      employeeId: args.employeeId,
    });

    return id;
  },
});

export const removeFace = authedMutation({
  args: { employeeId: v.id("employees") },
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
    const face = await ctx.db
      .query("employeeFaces")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
    if (!face) return;
    await ctx.storage.delete(face.pictureStorageId);
    await ctx.db.delete(face._id);
    await ctx.scheduler.runAfter(0, api.actions.hikvisionSync.deleteEmployeeFaceFromDevices, {
      employeeId: args.employeeId,
    });
  },
});

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
    return {
      _id: face._id,
      pictureStorageId: face.pictureStorageId,
      projectId: face.projectId,
    };
  },
});

