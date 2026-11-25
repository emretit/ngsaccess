import { internalMutation, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { assertUploadOwner } from "./lib/peopleScope";
import { v } from "convex/values";
import { authedAction, authedMutation } from "./lib/customFunctions";
import { requirePermission } from "./lib/permissions";
import { getCurrentUser } from "./lib/auth";
import { assertPhotoContentType } from "./lib/peoplePhoto";

const PENDING_CLEANUP_BATCH = 200;

function findPendingUpload(ctx: Pick<QueryCtx, "db">, storageId: Id<"_storage">) {
  return ctx.db.query("pendingUploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique();
}

async function rejectRequestAttachment(ctx: Pick<QueryCtx, "db">, storageId: Id<"_storage">) {
  const attachment = await ctx.db.query("requestAttachments").withIndex("by_storageId", q => q.eq("storageId", storageId)).first();
  if (attachment) throw new Error("Talep belgelerine yalnız talep üzerinden erişilebilir");
}

// Storage IDs are not proof of ownership. Only this server-side upload path
// creates pending ownership; the client never registers an arbitrary blob ID.
export const upload = authedAction({
  args: { bytes: v.bytes(), mimeType: v.string() },
  handler: async (ctx, args): Promise<Id<"_storage">> => {
    if (!args.bytes.byteLength || args.bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Dosya boyutu 1 bayt ile 5 MB arasında olmalıdır");
    }
    const bytes = new Uint8Array(args.bytes);
    const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
    const detected = starts(0xff, 0xd8, 0xff) ? "image/jpeg"
      : starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) ? "image/png"
      : starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 ? "image/webp"
      : undefined;
    if (!detected || detected !== args.mimeType) throw new Error("Dosya içeriği ve MIME türü eşleşmiyor");
    const storageId = await ctx.storage.store(new Blob([args.bytes], { type: detected }));
    try {
      await ctx.runMutation(internal.files.registerUpload, { storageId });
      return storageId;
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});

export const registerUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const recent = await ctx.db.query("pendingUploads")
      .withIndex("by_user", q => q.eq("userId", user._id).gte("createdAt", Date.now() - 24 * 60 * 60 * 1000))
      .take(21);
    if (recent.length >= 20) throw new Error("Son 24 saatte en fazla 20 bekleyen yükleme olabilir");
    await ctx.db.insert("pendingUploads", { ...args, userId: user._id, createdAt: Date.now() });
  },
});

export const claimUpload = authedMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await rejectRequestAttachment(ctx, args.storageId);
    const consent = await ctx.db.query("employeeConsents").withIndex("by_document_storage", q => q.eq("documentStorageId", args.storageId)).first();
    if (consent) throw new Error("Dosya zaten bir rızaya bağlı");
    const pending = await findPendingUpload(ctx, args.storageId);
    assertUploadOwner(pending?.userId, ctx.user._id);
  },
});

export const saveUserPhoto = authedMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await rejectRequestAttachment(ctx, args.storageId);
    const pending = await findPendingUpload(ctx, args.storageId);
    assertUploadOwner(pending?.userId, ctx.user._id);
    await assertPhotoContentType(ctx, args.storageId);
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
    await rejectRequestAttachment(ctx, args.storageId);
    const employee = await ctx.db.query("employees").withIndex("by_photo_storage", q => q.eq("photoStorageId", args.storageId)).first();
    if (employee) {
      await requirePermission(ctx, ctx.user, employee.projectId, "employees.manage");
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
    // No picture-storage index exists: scan face references once per cleanup batch.
    const candidates = new Set(pending.map(upload => upload.storageId));
    const faceReferences = new Set<Id<"_storage">>();
    if (pending.length) {
      for await (const face of ctx.db.query("employeeFaces")) {
        if (candidates.has(face.pictureStorageId)) faceReferences.add(face.pictureStorageId);
        if (faceReferences.size === candidates.size) break;
      }
    }
    for (const upload of pending) {
      const consent = await ctx.db.query("employeeConsents")
        .withIndex("by_document_storage", q => q.eq("documentStorageId", upload.storageId)).first();
      const attachment = await ctx.db.query("requestAttachments")
        .withIndex("by_storageId", q => q.eq("storageId", upload.storageId)).first();
      if (consent || attachment || faceReferences.has(upload.storageId)) {
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
