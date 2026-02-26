import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

export function useDarkMode() {
  const { projectIds } = useProjectAccess();
  const projectId = projectIds[0] as Id<"projects"> | undefined;

  const darkMode = useQuery(api.settings.getDarkMode, { projectId });
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
    } catch (e) {
      // sessizce devam et
    }
  };

  return { isDarkMode: darkMode ?? false, toggleDarkMode };
}
