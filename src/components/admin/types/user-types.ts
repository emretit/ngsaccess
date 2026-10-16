import type { Id } from "../../../../convex/_generated/dataModel";

export type UserRole = 'super_admin' | 'project_admin' | 'project_user';

export type User = import("convex/server").FunctionReturnType<typeof import("../../../../convex/_generated/api").api.users.list>[number];
export type Project = import("convex/server").FunctionReturnType<typeof import("../../../../convex/_generated/api").api.projects.list>[number];

export interface UserFormData {
  email: string;
  projectIds?: Id<"projects">[];
  role: UserRole;
  projectId?: Id<"projects">;
}
