import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Id } from "../../convex/_generated/dataModel";

export interface Department {
  _id: Id<"departments">;
  name: string;
  projectId?: Id<"projects">;
  parentId?: Id<"departments"> | null;
  companyId?: Id<"companies">;
  level?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function useDepartments() {
  const { projectId, loading: projectLoading } = useActiveProjectScope();

  const departments = useQuery(
    api.departments.list,
    !projectLoading && projectId ? { projectId } : "skip",
  );

  const createDept = useMutation(api.departments.create);
  const updateDept = useMutation(api.departments.update);
  const renameDepartment = async (
    departmentId: Id<"departments">,
    name: string,
  ) => {
    await updateDept({ departmentId, name: name.trim() });
    return true;
  };
  const removeDept = useMutation(api.departments.remove);

  const addDepartment = async (
    name: string,
    parentId: Id<"departments"> | null = null,
    companyId: Id<"companies"> | null = null,
  ) => {
    if (!name.trim()) throw new Error("Departman adı zorunludur");
    if (!projectId) throw new Error("Departman eklemek için proje seçin");
    const parentDept = parentId
      ? (departments ?? []).find((d) => d._id === parentId)
      : null;
    await createDept({
      name: name.trim(),
      projectId,
      parentId: parentId ?? undefined,
      companyId: companyId ?? undefined,
      level: parentDept ? (parentDept.level ?? 0) + 1 : 0,
    });
    return true;
  };
  const setCompany = useMutation(api.departments.setCompany);
  const moveDepartmentToCompany = async (
    departmentId: Id<"departments">,
    companyId: Id<"companies"> | null,
  ) => {
    await setCompany({ departmentId, companyId });
    return true;
  };

  const deleteDepartment = async (id: Id<"departments">) => {
    await removeDept({ departmentId: id });
    return true;
  };

  return {
    departments: (departments ?? []) as Department[],
    isLoading:
      projectLoading || Boolean(projectId && departments === undefined),
    error: null,
    addDepartment,
    renameDepartment,
    deleteDepartment,
    moveDepartmentToCompany,
    fetchDepartments: () => {},
  };
}
