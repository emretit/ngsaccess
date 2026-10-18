import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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

/**
 * Proje değişiminden önce çağrılır. `true` dönerse değişim durur; guard kullanıcı onayından sonra
 * `proceed()` çağırarak değişimi tamamlar. Layout sayfayı proje değişince yeniden kurduğu için
 * kirli taslaklar bu kayıt olmadan sessizce kaybolur.
 */
export type ProjectChangeGuard = (proceed: () => void) => boolean;

interface ActiveProjectContextValue {
  projectIds: Id<"projects">[];
  projects: ProjectSummary[];
  activeProjectId: Id<"projects"> | null;
  projectId: Id<"projects"> | undefined;
  activeProject: ProjectSummary | null;
  setActiveProjectId: (id: Id<"projects">) => void;
  /** Kayıt sırasıyla sorulur; ilk `true` dönen guard değişimi durdurur. Dönen fonksiyon kaydı siler. */
  registerProjectChangeGuard: (guard: ProjectChangeGuard) => () => void;
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

  const projectsResolved = !authLoading && isAuthenticated && Boolean(profile) &&
    (isSuperAdmin ? allProjects !== undefined : userProjects !== undefined);

  useEffect(() => {
    if (!projectsResolved) return;
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
  }, [projectIds, activeProjectId, projectsResolved]);

  const commitProjectId = useCallback((id: Id<"projects">) => {
    setActiveProjectIdState((prev) => {
      if (prev === id) return prev;
      writeStoredId(id);
      return id;
    });
  }, []);

  const guards = useRef(new Set<ProjectChangeGuard>());
  const currentProjectId = useRef(activeProjectId);
  useLayoutEffect(() => {
    currentProjectId.current = activeProjectId;
  }, [activeProjectId]);

  const setActiveProjectId = useCallback((id: Id<"projects">) => {
    if (currentProjectId.current === id) return;
    const proceed = () => commitProjectId(id);
    for (const guard of guards.current) {
      if (guard(proceed)) return;
    }
    proceed();
  }, [commitProjectId]);

  const registerProjectChangeGuard = useCallback((guard: ProjectChangeGuard) => {
    guards.current.add(guard);
    return () => {
      guards.current.delete(guard);
    };
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
      registerProjectChangeGuard,
      isSuperAdmin: !!isSuperAdmin,
      isAdmin: !!isAdmin,
      loading,
    }),
    [projectIds, projects, activeProjectId, activeProject, setActiveProjectId, registerProjectChangeGuard, isSuperAdmin, isAdmin, loading]
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

/**
 * `blocked` iken proje değişimini durdurur ve `intercept(proceed)` çağırır (ör. `useUnsavedChangesGuard().requestClose`).
 * Kaydetme sürerken onay sormadan durdurmak için `intercept` boş bir fonksiyon olabilir.
 */
export function useProjectChangeGuard(blocked: boolean, intercept: (proceed: () => void) => void) {
  const { registerProjectChangeGuard } = useActiveProject();
  const latest = useRef({ blocked, intercept });
  useLayoutEffect(() => {
    latest.current = { blocked, intercept };
  }, [blocked, intercept]);
  useEffect(() => registerProjectChangeGuard((proceed) => {
    if (!latest.current.blocked) return false;
    latest.current.intercept(proceed);
    return true;
  }), [registerProjectChangeGuard]);
}
