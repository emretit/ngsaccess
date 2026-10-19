import { v } from "convex/values";
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

export type PublicUser = Pick<
  Doc<"users">,
  | "_id"
  | "_creationTime"
  | "name"
  | "email"
  | "image"
  | "emailVerificationTime"
  | "phone"
  | "phoneVerificationTime"
  | "isAnonymous"
  | "fullName"
  | "photoUrl"
  | "role"
  | "verified"
  | "updatedAt"
>;

export function toPublicUser(user: Doc<"users">): PublicUser {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    ...(user.name !== undefined ? { name: user.name } : {}),
    ...(user.email !== undefined ? { email: user.email } : {}),
    ...(user.image !== undefined ? { image: user.image } : {}),
    ...(user.emailVerificationTime !== undefined ? { emailVerificationTime: user.emailVerificationTime } : {}),
    ...(user.phone !== undefined ? { phone: user.phone } : {}),
    ...(user.phoneVerificationTime !== undefined ? { phoneVerificationTime: user.phoneVerificationTime } : {}),
    ...(user.isAnonymous !== undefined ? { isAnonymous: user.isAnonymous } : {}),
    ...(user.fullName !== undefined ? { fullName: user.fullName } : {}),
    ...(user.photoUrl !== undefined ? { photoUrl: user.photoUrl } : {}),
    ...(user.role !== undefined ? { role: user.role } : {}),
    ...(user.verified !== undefined ? { verified: user.verified } : {}),
    ...(user.updatedAt !== undefined ? { updatedAt: user.updatedAt } : {}),
  };
}
