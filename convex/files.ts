import { internalMutation, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { assertUploadOwner } from "./lib/peopleScope";
import { v } from "convex/values";
import { authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

const PENDING_CLEANUP_BATCH = 200;

function findPendingUpload(ctx: Pick<QueryCtx, "db">, storageId: Id<"_storage">) {
  return ctx.db.query("pendingUploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique();
}

export const generateUploadUrl = authedMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const claimUpload = authedMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const consent = await ctx.db.query("employeeConsents").withIndex("by_document_storage", q => q.eq("documentStorageId", args.storageId)).first();
    if (consent) throw new Error("Dosya zaten bir rızaya bağlı");
    const pending = await findPendingUpload(ctx, args.storageId);
    if (pending) {
      assertUploadOwner(pending.userId, ctx.user._id);
      return;
    }
    const linked = await ctx.db.query("employees").withIndex("by_photo_storage", q => q.eq("photoStorageId", args.storageId)).first();
    if (linked) throw new Error("Fotoğraf zaten bir personele bağlı");
    if (!await ctx.db.system.get(args.storageId)) throw new Error("Yüklenen dosya bulunamadı");
    await ctx.db.insert("pendingUploads", { ...args, userId: ctx.user._id, createdAt: Date.now() });
  },
});

export const saveUserPhoto = authedMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const pending = await findPendingUpload(ctx, args.storageId);
    assertUploadOwner(pending?.userId, ctx.user._id);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Dosya URL'si alınamadı");
    await ctx.db.patch(ctx.user._id, {
      photoUrl: url,
      updatedAt: new Date().toISOString(),
    });
    if (pending) await ctx.db.delete(pending._id);
    return url;
  },
});

export const getUploadUrl = authedMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.query("employees").withIndex("by_photo_storage", q => q.eq("photoStorageId", args.storageId)).first();
    if (employee) {
      const allowed = await getProjectIdsForUser(ctx);
      if (!employee.projectId || !allowed.includes(employee.projectId)) throw new Error("Bu fotoğrafın projesine erişim yetkiniz yok");
    } else {
      const pending = await findPendingUpload(ctx, args.storageId);
      assertUploadOwner(pending?.userId, ctx.user._id);
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Fotoğraf URL’si alınamadı");
    return url;
  },
});

export const cleanupPendingUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db.query("pendingUploads")
      .withIndex("by_created", q => q.lt("createdAt", Date.now() - 24 * 60 * 60 * 1000))
      .take(PENDING_CLEANUP_BATCH);
    for (const upload of pending) {
      const consent = await ctx.db.query("employeeConsents")
        .withIndex("by_document_storage", q => q.eq("documentStorageId", upload.storageId)).first();
      if (consent) {
        await ctx.db.delete(upload._id);
        continue;
      }
      const employee = await ctx.db.query("employees")
        .withIndex("by_photo_storage", q => q.eq("photoStorageId", upload.storageId)).first();
      const url = employee ? null : await ctx.storage.getUrl(upload.storageId);
      const user = url ? await ctx.db.query("users")
        .withIndex("by_photo_url", q => q.eq("photoUrl", url)).first() : null;
      // url null = dosya zaten silinmiş; yalnız satır temizlenir.
      if (!employee && url && !user) await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
    }
    if (pending.length === PENDING_CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.files.cleanupPendingUploads, {});
    }
  },
});
