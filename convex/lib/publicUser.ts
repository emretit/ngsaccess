import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/** Profil/dizin yanıtlarında güvenli alanlar (izinli liste): yeni users alanları varsayılan olarak dışarıda kalır. */
export const publicUserValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  fullName: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
  role: v.optional(v.union(
    v.literal("super_admin"),
    v.literal("project_admin"),
    v.literal("project_user"),
  )),
  verified: v.optional(v.boolean()),
  updatedAt: v.optional(v.string()),
});

export type PublicUser = Infer<typeof publicUserValidator>;

export function toPublicUser(user: Doc<"users">): PublicUser {
  const result: Partial<PublicUser> = {};
  for (const field of Object.keys(publicUserValidator.fields) as (keyof PublicUser)[]) {
    const value = user[field];
    if (value !== undefined) {
      Object.assign(result, { [field]: value });
    }
  }
  // Döngü yalnız validator anahtarlarını kopyalar; zorunlu alanlar (_id, _creationTime) her users belgesinde var.
  return result as PublicUser;
}
