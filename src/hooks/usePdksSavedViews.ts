import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";

const PREFERENCE_KEY = "pdksSavedViews";

export interface SavedView {
  id: string;
  name: string;
  filters: SerializableFilters;
}

interface SerializableFilters {
  dateFrom?: string;
  dateTo?: string;
  reportType: string;
  companyId?: string;
  departmentId?: string;
  positionId?: string;
  shiftId?: string;
  statusFilter: string;
  person: string;
}

function serialize(f: FilterValues): SerializableFilters {
  return {
    dateFrom: f.dateRange.from?.toISOString(),
    dateTo: f.dateRange.to?.toISOString(),
    reportType: f.reportType,
    companyId: f.companyId,
    departmentId: f.departmentId,
    positionId: f.positionId,
    shiftId: f.shiftId,
    statusFilter: f.statusFilter,
    person: f.person,
  };
}

function deserialize(s: SerializableFilters): FilterValues {
  return {
    dateRange: {
      from: s.dateFrom ? new Date(s.dateFrom) : undefined,
      to: s.dateTo ? new Date(s.dateTo) : undefined,
    },
    reportType: s.reportType as FilterValues["reportType"],
    companyId: s.companyId as FilterValues["companyId"],
    departmentId: s.departmentId as FilterValues["departmentId"],
    positionId: s.positionId as FilterValues["positionId"],
    shiftId: s.shiftId as FilterValues["shiftId"],
    statusFilter: s.statusFilter as FilterValues["statusFilter"],
    person: s.person,
  };
}

function parseViews(raw: string | null | undefined): SavedView[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

export function usePdksSavedViews() {
  const remote = useQuery(api.userPreferences.get, { key: PREFERENCE_KEY });
  const setRemote = useMutation(api.userPreferences.set);

  const views = useMemo<SavedView[]>(() => parseViews(remote), [remote]);

  const persist = useCallback(
    async (next: SavedView[]) => {
      await setRemote({ key: PREFERENCE_KEY, value: JSON.stringify(next) });
    },
    [setRemote],
  );

  const save = useCallback(
    (name: string, filters: FilterValues) => {
      const view: SavedView = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        filters: serialize(filters),
      };
      const next = [...views, view];
      void persist(next);
      return view;
    },
    [views, persist],
  );

  const removeView = useCallback(
    (id: string) => {
      const next = views.filter((v) => v.id !== id);
      void persist(next);
    },
    [views, persist],
  );

  const apply = useCallback((view: SavedView): FilterValues => {
    return deserialize(view.filters);
  }, []);

  return { views, save, remove: removeView, apply };
}
