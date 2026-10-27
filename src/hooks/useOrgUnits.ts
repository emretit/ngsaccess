import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";

export type Company = FunctionReturnType<typeof api.companies.list>[number];
export type Position = FunctionReturnType<typeof api.positions.list>[number];
export type CompanyDetails = { name: string; address?: string; phone?: string; email?: string; taxNumber?: string };

/** Seçili projenin şirketleri (şubeleri) ve yönetim işlemleri. */
export function useCompanies() {
  const { projectId, loading } = useActiveProjectScope();
  const companies = useQuery(api.companies.list, !loading && projectId ? { projectId } : "skip");
  const create = useMutation(api.companies.create);
  const update = useMutation(api.companies.update);
  const remove = useMutation(api.companies.remove);
  return {
    companies: companies ?? [],
    isLoading: loading || Boolean(projectId && companies === undefined),
    addCompany: async (details: CompanyDetails) => {
      if (!projectId) throw new Error("Şirket eklemek için proje seçin");
      return await create({ projectId, ...details });
    },
    updateCompany: async (companyId: Id<"companies">, details: CompanyDetails) => { await update({ companyId, ...details }); },
    deleteCompany: async (companyId: Id<"companies">) => { await remove({ companyId }); },
  };
}

/** Seçili projenin pozisyonları ve yönetim işlemleri. */
export function usePositions() {
  const { projectId, loading } = useActiveProjectScope();
  const positions = useQuery(api.positions.list, !loading && projectId ? { projectId } : "skip");
  const create = useMutation(api.positions.create);
  const update = useMutation(api.positions.update);
  const remove = useMutation(api.positions.remove);
  return {
    positions: positions ?? [],
    isLoading: loading || Boolean(projectId && positions === undefined),
    addPosition: async (name: string) => {
      if (!projectId) throw new Error("Pozisyon eklemek için proje seçin");
      return await create({ projectId, name });
    },
    renamePosition: async (positionId: Id<"positions">, name: string) => { await update({ positionId, name }); },
    deletePosition: async (positionId: Id<"positions">) => { await remove({ positionId }); },
  };
}
