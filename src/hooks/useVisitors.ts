import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProjectScope } from "./useActiveProjectScope";
import type { VisitorStatus } from "@/components/visitors/lib/status";

// Only VisitorManagement consumes this hook; pagination uses the raw server cursor.
export const useVisitors = (options: { search?: string; status?: VisitorStatus; cursor?: string | null; pageSize?: number; now?: number } = {}) => {
  const { projectId, loading: projectLoading } = useActiveProjectScope();
  const page = useQuery(api.visitors.listPage, !projectLoading && projectId ? {
    projectId, search: options.search, status: options.status, now: options.now,
    paginationOpts: { numItems: options.pageSize ?? 25, cursor: options.cursor ?? null },
  } : "skip");
  return {
    visitors: page?.page ?? [], page,
    isLoading: projectLoading || (!!projectId && page === undefined),
    hasProjectAccess: projectLoading || !!projectId,
  };
};
