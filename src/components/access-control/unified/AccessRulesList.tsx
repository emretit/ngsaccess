import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { RecentRuns } from "./SyncRuns";
import { readRuleFilters } from "./rules-list/accessRulesListModel";
import { RulesFilters } from "./rules-list/RulesFilters";
import { RulesPage } from "./rules-list/RulesPage";
import type { Props } from "./rules-list/types";
export default function AccessRulesList(props: Props) {
  const { projectId, loading } = useActiveProject();
  const [params, setParams] = useSearchParams();
  const { search, searchBy, status, type } = readRuleFilters(params);
  const change = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== "all") next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const clear = () =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      ["q", "by", "durum", "tur"].forEach((key) => next.delete(key));
      return next;
    });
  const queryKey = JSON.stringify([projectId, search, searchBy, status, type]);
  return (
    <div className="space-y-4 min-w-0">
      {loading ? (
        <SectionSkeleton label="Proje yükleniyor" />
      ) : !projectId ? (
        <EmptyState
          title="Önce bir proje seçin"
          description="Erişim kuralları seçili proje için gösterilir."
        />
      ) : (
        <>
          <RulesFilters
            search={search}
            searchBy={searchBy}
            status={status}
            type={type}
            change={change}
            clear={clear}
          />
          <QuerySectionBoundary
            resetKey={queryKey}
            title="Erişim kuralları yüklenemedi"
          >
            <RulesPage
              key={queryKey}
              projectId={projectId}
              search={search}
              searchBy={searchBy}
              status={status}
              type={type}
              clear={clear}
              {...props}
            />
          </QuerySectionBoundary>
          <QuerySectionBoundary resetKey={projectId}>
            <RecentRuns projectId={projectId} />
          </QuerySectionBoundary>
        </>
      )}
    </div>
  );
}
