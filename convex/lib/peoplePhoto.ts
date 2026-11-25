import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { assertEmployeePhotoClaim } from "./peopleScope";

const PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function assertPhotoContentType(ctx: Pick<QueryCtx, "db">, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get(storageId);
  if (!metadata?.contentType || !PHOTO_CONTENT_TYPES.has(metadata.contentType)) {
    throw new Error("Fotoğraf JPEG, PNG veya WebP biçiminde olmalıdır");
  }
}

/** Sahiplik denetimi ve pending tüketimi personel yazımıyla aynı transaction'dadır. */
export async function claimEmployeePhoto(ctx: MutationCtx, storageId: Id<"_storage">, userId: Id<"users">, employeeId?: Id<"employees">) {
  const pending = await ctx.db.query("pendingUploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique();
  const linked = await ctx.db.query("employees").withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).first();
  assertEmployeePhotoClaim(pending?.userId, userId, linked?._id, employeeId);
  await assertPhotoContentType(ctx, storageId);
  const photoUrl = await ctx.storage.getUrl(storageId);
  if (!photoUrl) throw new Error("Fotoğraf URL'si alınamadı");
  if (pending) await ctx.db.delete(pending._id);
  return { photoStorageId: storageId, photoUrl };
}
