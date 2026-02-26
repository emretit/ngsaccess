import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { Id } from "../../convex/_generated/dataModel";

interface ProjectAccess {
  projectIds: Id<"projects">[];
  isSuperAdmin: boolean;
  loading: boolean;
}

export const useProjectAccess = (): ProjectAccess => {
  const { profile, loading: authLoading } = useAuth();
  const { isAuthenticated } = useConvexAuth();

  const userProjects = useQuery(
    api.userProjects.getByCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const allProjects = useQuery(
    api.projects.listActive,
    profile?.role === "super_admin" ? {} : "skip"
  );

  const isSuperAdmin = profile?.role === "super_admin";

  if (isSuperAdmin) {
    const projectIds = (allProjects ?? []).map((p: { _id: Id<"projects"> }) => p._id);
    return {
      projectIds,
      isSuperAdmin: true,
      loading: authLoading || allProjects === undefined,
    };
  }

  const projectIds = (userProjects ?? []).map(
    (up: { projectId: Id<"projects"> }) => up.projectId
  );

  return {
    projectIds,
    isSuperAdmin: false,
    loading: authLoading || (!isAuthenticated ? false : userProjects === undefined),
  };
};
