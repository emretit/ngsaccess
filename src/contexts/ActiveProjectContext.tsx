import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Id } from "../../convex/_generated/dataModel";

const STORAGE_KEY = "ngs.activeProjectId";

interface ProjectSummary {
  _id: Id<"projects">;
  name: string;
}

interface ActiveProjectContextValue {
  projectIds: Id<"projects">[];
  projects: ProjectSummary[];
  activeProjectId: Id<"projects"> | null;
  projectId: Id<"projects"> | undefined;
  activeProject: ProjectSummary | null;
  setActiveProjectId: (id: Id<"projects">) => void;
  isSuperAdmin: boolean;
  /** super_admin VEYA project_admin — cihaz claim/release gibi yönetimsel aksiyonlar için. */
  isAdmin: boolean;
  loading: boolean;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue | undefined>(undefined);

function readStoredId(): Id<"projects"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (raw as Id<"projects">) : null;
  } catch {
    return null;
  }
}

function writeStoredId(id: Id<"projects"> | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / disabled storage
  }
}

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const isSuperAdmin = profile?.role === "super_admin";
  const isAdmin = isSuperAdmin || profile?.role === "project_admin";

  const userProjects = useQuery(
    api.userProjects.getByCurrentUser,
    isAuthenticated && !isSuperAdmin ? {} : "skip"
  );
  const allProjects = useQuery(
    api.projects.listActive,
    isAuthenticated && isSuperAdmin ? {} : "skip"
  );

  const projects = useMemo<ProjectSummary[]>(() => {
    if (isSuperAdmin) {
      return (allProjects ?? []).map((p) => ({ _id: p._id, name: p.name }));
    }
    return (userProjects ?? []).map((up) => ({
      _id: up.projectId,
      name: up.projectName,
    }));
  }, [isSuperAdmin, allProjects, userProjects]);

  const projectIds = useMemo(() => projects.map((p) => p._id), [projects]);

  const [activeProjectId, setActiveProjectIdState] = useState<Id<"projects"> | null>(
    () => readStoredId()
  );

  useEffect(() => {
    if (projectIds.length === 0) {
      if (activeProjectId !== null) {
        setActiveProjectIdState(null);
        writeStoredId(null);
      }
      return;
    }
    if (!activeProjectId || !projectIds.includes(activeProjectId)) {
      const next = projectIds[0];
      setActiveProjectIdState(next);
      writeStoredId(next);
    }
  }, [projectIds, activeProjectId]);

  const setActiveProjectId = useCallback((id: Id<"projects">) => {
    setActiveProjectIdState((prev) => {
      if (prev === id) return prev;
      writeStoredId(id);
      return id;
    });
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p._id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const projectSelectionResolved =
    projectIds.length === 0 ? activeProjectId === null : activeProject !== null;

  const loading =
    authLoading ||
    (isAuthenticated && isSuperAdmin && allProjects === undefined) ||
    (isAuthenticated && !isSuperAdmin && userProjects === undefined) ||
    !projectSelectionResolved;

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      projectIds,
      projects,
      activeProjectId,
      projectId: activeProject?._id,
      activeProject,
      setActiveProjectId,
      isSuperAdmin: !!isSuperAdmin,
      isAdmin: !!isAdmin,
      loading,
    }),
    [projectIds, projects, activeProjectId, activeProject, setActiveProjectId, isSuperAdmin, isAdmin, loading]
  );

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject(): ActiveProjectContextValue {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error("useActiveProject must be used within ActiveProjectProvider");
  }
  return ctx;
}
