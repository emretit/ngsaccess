import { useEffect, useLayoutEffect } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { clearThemeScope, readThemeCache, writeThemeCache } from "@/lib/themeBootstrap";

/** Lives above routing so logout on a public page also invalidates the visual hint. */
export function ThemeSessionSync() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  useLayoutEffect(() => {
    if (isLoading || (isAuthenticated && user === undefined)) return;
    try {
      const cache = readThemeCache(window.localStorage, '/home');
      if (!isAuthenticated || !user || cache?.userId !== user._id) {
        clearThemeScope(window.localStorage);
        document.documentElement.classList.remove('dark');
      }
    } catch { document.documentElement.classList.remove('dark'); }
  }, [isAuthenticated, isLoading, user]);

  useEffect(() => {
    const reconcile = () => {
      try {
        const cache = readThemeCache(window.localStorage, window.location.pathname);
        if (!cache || cache.userId !== user?._id) document.documentElement.classList.remove('dark');
      } catch { document.documentElement.classList.remove('dark'); }
    };
    window.addEventListener('storage', reconcile);
    return () => window.removeEventListener('storage', reconcile);
  }, [user]);
  return null;
}

export function useDarkMode() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { profile, loading: authLoading } = useAuth();
  const { projectId, activeProjectId, loading: projectLoading } = useActiveProject();
  const darkMode = useQuery(
    api.settings.getDarkMode,
    isAuthenticated && !projectLoading && projectId ? { projectId } : "skip"
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    try {
      // Keep a startup hint only while it still matches every identity already known.
      if (isLoading || authLoading || projectLoading) {
        const cache = readThemeCache(window.localStorage, window.location.pathname);
        if (!cache || (profile && cache.userId !== profile._id) ||
          (activeProjectId && cache.projectId !== activeProjectId)) {
          clearThemeScope(window.localStorage);
          root.classList.remove('dark');
        }
        return;
      }
      if (!isAuthenticated || !profile || !projectId) {
        clearThemeScope(window.localStorage);
        root.classList.remove('dark');
        return;
      }
      const scope = { v: 1 as const, userId: profile._id, projectId };
      if (typeof darkMode === 'boolean') {
        writeThemeCache(window.localStorage, scope, darkMode);
        root.classList.toggle('dark', darkMode);
      } else {
        const cache = readThemeCache(window.localStorage, window.location.pathname);
        const matches = cache?.userId === profile._id && cache?.projectId === projectId;
        if (!matches) clearThemeScope(window.localStorage);
        root.classList.toggle('dark', matches && cache?.dark === true);
      }
    } catch { root.classList.toggle('dark', darkMode === true); }
  }, [darkMode, isAuthenticated, isLoading, authLoading, profile, projectId, activeProjectId, projectLoading]);

  // Public pages stay light; removing the shell does not invalidate a verified preference.
  useEffect(() => () => document.documentElement.classList.remove("dark"), []);
  return { isDarkMode: darkMode ?? false };
}
