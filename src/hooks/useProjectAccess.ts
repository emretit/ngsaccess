import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../convex/_generated/dataModel";

interface ProjectAccess {
  projectIds: Id<"projects">[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  loading: boolean;
}

export const useProjectAccess = (): ProjectAccess => {
  const { projectIds, isSuperAdmin, isAdmin, loading } = useActiveProject();
  return { projectIds, isSuperAdmin, isAdmin, loading };
};
