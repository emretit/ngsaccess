import { usePermissions } from "@/hooks/usePermissions";
import type { ReactNode } from "react";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
export default function ProjectFilter({ children, requiredRole = "project_user", showNoAccess = true }: {
  children: ReactNode; requiredRole?: "super_admin" | "project_admin" | "project_user" | "admin"; showNoAccess?: boolean;
}) {
  const { projectIds, isSuperAdmin, loading } = useProjectAccess();
  const { can, loading: permissionsLoading } = usePermissions();
  if (loading || permissionsLoading) return <SectionSkeleton label="Yetkiler yükleniyor" />;
  const allowed = requiredRole === "super_admin" ? isSuperAdmin
    : requiredRole === "admin" || requiredRole === "project_admin" ? can("admin.manage")
    : isSuperAdmin || projectIds.length > 0;
  if (!allowed) return showNoAccess ? <AccessDenied message="Bu sayfa için gerekli yetkiniz bulunmuyor." /> : null;
  return <>{children}</>;
}
