import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

export function useDarkMode() {
  const { isAuthenticated } = useConvexAuth();
  const { projectId } = useActiveProject();

  const darkMode = useQuery(
    api.settings.getDarkMode,
    isAuthenticated ? { projectId } : "skip"
  );
  const upsertGeneral = useMutation(api.settings.upsertGeneral);

  useEffect(() => {
    if (darkMode === true) {
      document.documentElement.classList.add("dark");
    } else if (darkMode === false) {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = async (enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      await upsertGeneral({
        projectId,
        companyName: "NGS Access",
        darkMode: enabled,
      });
    } catch {
      // sessizce devam et
    }
  };

  return { isDarkMode: darkMode ?? false, toggleDarkMode };
}
