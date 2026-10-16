import { useAuth } from "@/components/auth/AuthProvider";
export function useProfileUtils() {
  const { user, profile } = useAuth();
  const formData = {
    email: user?.email ?? profile?.email ?? "",
    fullName: profile?.fullName ?? profile?.name ?? "",
    photoUrl: profile?.photoUrl ?? profile?.image ?? "",
  };
  const getUserInitials = () => formData.fullName.trim().split(/\s+/).map(part => part[0] ?? "").slice(0, 2).join("").toUpperCase() || "KU";
  return { formData, getUserInitials };
}
