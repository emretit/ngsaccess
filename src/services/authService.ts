export interface AuthError {
  message: string;
}

export type UserRole = "super_admin" | "project_admin" | "project_user";

export const checkUserRole = (
  profile: { role?: UserRole } | null,
  requiredRole: UserRole
): boolean => {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "project_admin") {
    return requiredRole === "project_admin" || requiredRole === "project_user";
  }
  if (profile.role === "project_user") {
    return requiredRole === "project_user";
  }
  return false;
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
