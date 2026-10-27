import { Plus } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { PageHeaderPrimaryButton } from "@/components/shared/PageHeader";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { ProjectSyncButton, RecentRuns } from "./SyncRuns";
import { readRuleFilters } from "./rules-list/accessRulesListModel";
import { RulesFilters } from "./rules-list/RulesFilters";
import { RulesPage } from "./rules-list/RulesPage";
import type { Props } from "./rules-list/types";
export default function AccessRulesList(props: Props) {
  const { projectId, loading } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("accessRules.manage");
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
      <div className="flex flex-wrap justify-between gap-2 items-center max-md:[&_button]:min-h-11">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Kurallar</h1>
          <p className="text-sm text-muted-foreground">Kişilerin hangi kapılardan hangi gün ve saatlerde geçebileceğini belirleyin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && projectId && (
            <>
              <QuerySectionBoundary resetKey={projectId}>
                <ProjectSyncButton projectId={projectId} />
              </QuerySectionBoundary>
              <PageHeaderPrimaryButton onClick={props.onCreateRule}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Yeni kural
              </PageHeaderPrimaryButton>
            </>
          )}
        </div>
      </div>
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
