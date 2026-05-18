import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../convex/_generated/dataModel";

interface ProjectAccess {
  projectIds: Id<"projects">[];
  isSuperAdmin: boolean;
  loading: boolean;
}

export const useProjectAccess = (): ProjectAccess => {
  const { projectIds, isSuperAdmin, loading } = useActiveProject();
  return { projectIds, isSuperAdmin, loading };
};
