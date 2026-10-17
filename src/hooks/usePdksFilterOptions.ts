import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
export function usePdksFilterOptions() {
  const { projectId } = useActiveProject();
  const departments = useQuery(
    api.departments.list,
    projectId ? { projectId } : "skip",
  );
  const companies = useQuery(
    api.companies.list,
    projectId ? { projectId } : "skip",
  );
  const allPositions = useQuery(api.positions.list, projectId ? {} : "skip");
  // Positions has no project argument; narrow its authorized catalog locally.
  const positions = allPositions?.filter(
    (position) => position.projectId === projectId,
  );
  const shifts = useQuery(api.shifts.list, projectId ? { projectId } : "skip");
  return { departments, companies, positions, shifts };
}
