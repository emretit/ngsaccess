import { usePermissions } from "@/hooks/usePermissions";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatInline } from "@/components/shared/StatInline";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { ProjectSyncButton, RecentRuns } from "./SyncRuns";
import { readRuleFilters } from "./rules-list/accessRulesListModel";
import { RulesFilters } from "./rules-list/RulesFilters";
import { RulesPage } from "./rules-list/RulesPage";
import type { Props } from "./rules-list/types";
export default function AccessRulesList(props: Props) {
  const { projectId, activeProject, loading } = useActiveProject();
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
  const [pageCount, setPageCount] = useState<{
    key: string;
    count: number | undefined;
  } | null>(null);
  const queryKey = JSON.stringify([projectId, search, searchBy, status, type]);
  const onCount = useCallback(
    (count: number | undefined) => setPageCount({ key: queryKey, count }),
    [queryKey, setPageCount],
  );
  return (
    <div className="space-y-4 min-w-0">
      <PageHeader
        className="max-md:[&_button]:min-h-11"
        title="Geçiş Kontrol"
        scope={`${activeProject?.name ?? "Proje seçilmedi"} · Erişim kuralları`}
        primaryAction={
          canManage && projectId
            ? { label: "Yeni kural", onClick: props.onCreateRule }
            : undefined
        }
      >
        {canManage && projectId && (
          <QuerySectionBoundary resetKey={projectId}>
            <ProjectSyncButton projectId={projectId} />
          </QuerySectionBoundary>
        )}
      </PageHeader>
      {loading ? (
        <SectionSkeleton label="Proje yükleniyor" />
      ) : !projectId ? (
        <EmptyState
          title="Önce bir proje seçin"
          description="Erişim kuralları seçili proje için gösterilir."
        />
      ) : (
        <>
          <StatInline
            items={[
              {
                label: "Bu sayfada",
                value:
                  pageCount?.key === queryKey && pageCount.count !== undefined
                    ? `${pageCount.count} kural`
                    : null,
              },
            ]}
          />
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
              onCount={onCount}
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
