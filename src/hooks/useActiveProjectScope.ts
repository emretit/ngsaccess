import { useActiveProject } from "@/contexts/ActiveProjectContext";

/** projectIds tüm erişilebilir projelerdir; ekran sorgularında projectId kullanılır. */
export function useActiveProjectScope() {
  const { projectId, projectIds, activeProject, loading, isSuperAdmin, isAdmin } = useActiveProject();
  return { projectId, projectIds, activeProject, loading, isSuperAdmin, isAdmin };
}
