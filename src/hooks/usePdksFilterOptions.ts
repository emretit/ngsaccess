import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
export function usePdksFilterOptions() {
  const { projectId } = useActiveProject();
  const departmentRows = useQuery(
    api.departments.list,
    projectId ? { projectId } : "skip",
  );
  const companies = useQuery(
    api.companies.list,
    projectId ? { projectId } : "skip",
  );
  // Parametresiz çağrı eski Convex sürümüyle de çalışır; proje istemcide süzülür.
  const allPositions = useQuery(api.positions.list, projectId ? {} : "skip");
  const positions = allPositions?.filter((position) => position.projectId === projectId);
  const shifts = useQuery(api.shifts.list, projectId ? { projectId } : "skip");
  // Aynı departman adı birden çok şirkette olabilir: seçenekte şirket adı öne eklenir.
  const companyNames = new Map((companies ?? []).map((company) => [company._id, company.name]));
  const departments = departmentRows?.map((department) => {
    const companyName = department.companyId && companyNames.get(department.companyId);
    return companyName ? { ...department, name: `${companyName} / ${department.name}` } : department;
  });
  return { departments, companies, positions, shifts };
}
