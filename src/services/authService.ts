import type { Permission } from "../../convex/lib/roleCatalog";
export interface AuthError {
  message: string;
}

export type UserRole = "super_admin" | "project_admin" | "project_user";

/** Compatibility account check; project management always requires current permissions. */
export const checkUserRole = (
  profile: { role?: UserRole } | null,
  requiredRole: UserRole,
  can: (permission: Permission) => boolean = () => false,
): boolean => {
  if (!profile) return false;
  if (requiredRole === "super_admin") return profile.role === "super_admin";
  const requiredPermission: Partial<Record<UserRole, Permission>> = { project_admin: "admin.manage" };
  const permission = requiredPermission[requiredRole];
  return permission ? can(permission) : true;
};

export const redirectBasedOnRole = (
  _role: string,
  navigate: (path: string) => void,
  currentPath: string
) => {
  if (
    currentPath !== "/login" &&
    currentPath !== "/register" &&
    currentPath !== "/"
  ) {
    return;
  }
  navigate("/home");
};
