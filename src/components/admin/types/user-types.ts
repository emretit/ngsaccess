import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";

export type UserRole = "super_admin" | "project_admin" | "project_user";
export type User =
  | FunctionReturnType<typeof api.users.list>[number]
  | FunctionReturnType<typeof api.users.adminList>["page"][number];
export type Project = FunctionReturnType<typeof api.projects.list>[number];
export const userFormSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin."),
  role: z.enum(["super_admin", "project_admin", "project_user"]),
  projectId: z.custom<Id<"projects">>().optional(),
  projectIds: z.array(z.custom<Id<"projects">>()).optional(),
});
export type UserFormData = z.infer<typeof userFormSchema>;
export function userName(user: User) {
  return "displayName" in user
    ? user.displayName
    : user.fullName || user.email || "Adsız kullanıcı";
}
