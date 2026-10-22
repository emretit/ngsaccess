import { useCallback, useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Permission, ProjectRole } from "../../convex/lib/roleCatalog";

interface PermissionsState {
  /** Aktif projedeki rol; super_admin platform rolüdür, üye değilse null. */
  role: ProjectRole | "super_admin" | null;
  /** Yükleniyor veya proje yokken hep false (fail-closed). */
  can: (permission: Permission) => boolean;
  loading: boolean;
}

/**
 * Aktif projede çağıranın yetkileri (docs/roles/PLAN.md). Yalnız görünürlük içindir;
 * asıl karar sunucuda requirePermission ile verilir.
 */
export function usePermissions(): PermissionsState {
  const { isAuthenticated } = useConvexAuth();
  const { projectId, loading: projectLoading } = useActiveProject();
  const data = useQuery(api.roles.myPermissions, isAuthenticated && !projectLoading ? { projectId } : "skip");

  const granted = useMemo(() => new Set<Permission>(data?.permissions ?? []), [data]);
  const can = useCallback((permission: Permission) => granted.has(permission), [granted]);

  return { role: data?.role ?? null, can, loading: projectLoading || data === undefined };
}
