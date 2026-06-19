import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

export function useDarkMode() {
  const { isAuthenticated } = useConvexAuth();
  const { projectId, loading: projectLoading } = useActiveProject();

  const darkMode = useQuery(
    api.settings.getDarkMode,
    isAuthenticated && !projectLoading && projectId ? { projectId } : "skip"
  );

  useEffect(() => {
    if (darkMode === true) {
      document.documentElement.classList.add("dark");
    } else if (darkMode === false) {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return { isDarkMode: darkMode ?? false };
}
