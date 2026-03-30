// @ts-nocheck
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

export interface Department {
  _id: Id<"departments">;
  id?: string;
  name: string;
  projectId?: Id<"projects">;
  parentId?: Id<"departments">;
  level?: number;
  [key: string]: unknown;
}

export function useDepartments() {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const { toast } = useToast();

  const departments = useQuery(
    api.departments.list,
    !projectLoading ? {} : "skip"
  );

  const createDept = useMutation(api.departments.create);
  const removeDept = useMutation(api.departments.remove);

  const addDepartment = async (name: string, parentId: Id<"departments"> | null = null) => {
    if (!name.trim()) return false;
    const projectId = projectIds[0] as Id<"projects"> | undefined;
    const parentDept = parentId ? (departments ?? []).find((d: Department) => d._id === parentId) : null;
    try {
      await createDept({
        name: name.trim(),
        projectId,
        parentId: parentId ?? undefined,
        level: parentDept ? (parentDept.level ?? 0) + 1 : 0,
      });
      toast({ title: "Başarılı", description: "Departman başarıyla eklendi" });
      return true;
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Departman eklenirken hata oluştu",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteDepartment = async (id: Id<"departments">) => {
    try {
      await removeDept({ departmentId: id });
      toast({ title: "Başarılı", description: "Departman başarıyla silindi" });
      return true;
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Departman silinirken hata oluştu",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    departments: (departments ?? []) as Department[],
    isLoading: projectLoading || departments === undefined,
    error: null,
    addDepartment,
    deleteDepartment,
    fetchDepartments: () => {},
  };
}
