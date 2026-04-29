import type { Id } from "../../../../convex/_generated/dataModel";

export type UserRole = 'super_admin' | 'project_admin' | 'project_user';

export interface User {
  _id: Id<"users">;
  email?: string;
  role?: UserRole;
  createdAt?: string;
  updatedAt?: string;
  fullName?: string;
  name?: string;
  photoUrl?: string;
  setupToken?: string;
  tokenExpiresAt?: string;
}

export interface Project {
  _id: Id<"projects">;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UserFormData {
  email: string;
  password?: string;
  role: UserRole;
  projectId?: Id<"projects">;
}
