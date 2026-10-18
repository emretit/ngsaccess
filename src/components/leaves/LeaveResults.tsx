import { useEffect, useRef, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { LeaveList } from "./LeaveList";
import { type LeaveRow } from "./lib/leaveState";

export type LeaveQueryFilters = FunctionArgs<typeof api.leaves.summary>;
function LeaveSummary({
  filters,
  shown,
}: {
  filters: LeaveQueryFilters;
  shown: number;
}) {
  const summary = useQuery(api.leaves.summary, filters);
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {summary === undefined
        ? "İzin özeti yükleniyor…"
        : !summary.truncated
          ? `${summary.recordCount} kayıt · ${summary.employeeCount} kişi`
          : `${shown} kayıt gösteriliyor`}
    </p>
  );
}
function LeaveEmptyState({
  filters,
  isAdmin,
  onCreate,
  onClear,
}: {
  filters: LeaveQueryFilters;
  isAdmin: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  const filtered = Boolean(filters.employeeId || filters.leaveType);
  const projectSummary = useQuery(
    api.leaves.summary,
    filtered
      ? "skip"
      : {
          projectId: filters.projectId,
          rangeStart: "0001-01-01",
          rangeEnd: "9999-12-31",
        },
  );
  if (!filtered && projectSummary === undefined)
    return (
      <SectionSkeleton rows={1} label="İzin kayıtları kontrol ediliyor." />
    );
  if (
    !filtered &&
    projectSummary?.truncated === false &&
    projectSummary.recordCount === 0
  )
    return (
      <EmptyState
        title="Henüz izin kaydı yok."
        description={
          isAdmin
            ? "Bu proje için ilk izin kaydını ekleyin."
            : "Yöneticiniz kayıt eklediğinde burada görünür."
        }
        action={isAdmin ? { label: "İzin ekle", onClick: onCreate } : undefined}
      />
    );
  return (
    <EmptyState
      title="Bu filtrelerle eşleşen izin yok."
      description="Kişi, tür veya dönemi değiştirin."
      action={{ label: "Filtreleri temizle", onClick: onClear }}
    />
  );
}
export function LeaveResults({
  filters,
  pageSize,
  isAdmin,
  onCreate,
  onClear,
  onDetails,
  onEdit,
  requestedId,
  onRows,
}: {
  filters: LeaveQueryFilters;
  pageSize: number;
  isAdmin: boolean;
  onCreate: () => void;
  onClear: () => void;
  onDetails: (row: LeaveRow) => void;
  onEdit: (row: LeaveRow) => void;
  requestedId?: string;
  onRows: (rows: LeaveRow[]) => void;
}) {
  // Convex manages splitCursor / SplitRequired internally, including empty candidate pages.
  const { results, status, loadMore } = usePaginatedQuery(
    api.leaves.listPage,
    filters,
    { initialNumItems: pageSize },
  );
  const [pages, setPages] = useState([0]);
  const [index, setIndex] = useState(0);
  const [requested, setRequested] = useState<number | null>(null);
  useEffect(() => {
    if (requested === null) return;
    if (status !== "CanLoadMore" && status !== "Exhausted") return;
    setPages((previous) => [...previous, requested]);
    setIndex((previous) => previous + 1);
    setRequested(null);
  }, [status, requested]);
  useEffect(() => {
    onRows(results);
  }, [results, onRows]);
  const requestedOpened = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!requestedId || requestedOpened.current === requestedId) return;
    const row = results.find((item) => item._id === requestedId);
    if (row) {
      requestedOpened.current = requestedId;
      onDetails(row);
    }
  }, [requestedId, results, onDetails]);
  if (status === "LoadingFirstPage")
    return <SectionSkeleton rows={5} label="İzin kayıtları yükleniyor." />;
  const rows = results.slice(
    pages[index],
    pages[index + 1] ?? requested ?? undefined,
  );
  const loading = status === "LoadingMore" || requested !== null;
  const hasNext = index < pages.length - 1 || status === "CanLoadMore";
  const next = () => {
    if (index < pages.length - 1) setIndex(index + 1);
    else if (status === "CanLoadMore" && requested === null) {
      setRequested(results.length);
      loadMore(pageSize);
    }
  };
  return (
    <div className="min-w-0 space-y-4">
      <QuerySectionBoundary
        title="İzin özeti yüklenemedi."
        resetKey={JSON.stringify(filters)}
      >
        <LeaveSummary filters={filters} shown={rows.length} />
      </QuerySectionBoundary>
      {requestedId && !results.some((row) => row._id === requestedId) && (
        <p role="status" className="text-sm text-muted-foreground">
          Aranan kayıt bu sayfada bulunamadı. Sonraki kayıtları tarayın; kayıt
          başka projedeyse o projeyi seçin.
        </p>
      )}
      {rows.length ? (
        <LeaveList
          rows={rows}
          isAdmin={isAdmin}
          onDetails={onDetails}
          onEdit={onEdit}
        />
      ) : hasNext || pages.length > 1 ? (
        <EmptyState
          title="Bu sayfada eşleşen izin yok; daha eski kayıtları tarayın."
          description="Filtreler aday kayıt sayfasına uygulanır."
        />
      ) : (
        <QuerySectionBoundary
          title="İzin kayıtları kontrol edilemedi."
          resetKey={JSON.stringify(filters)}
        >
          <LeaveEmptyState
            filters={filters}
            isAdmin={isAdmin}
            onCreate={onCreate}
            onClear={onClear}
          />
        </QuerySectionBoundary>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span role="status">
          {loading
            ? "İzin kayıtları yükleniyor…"
            : `${index + 1}. sayfa · ${rows.length} kayıt gösteriliyor`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={index === 0 || loading}
            onClick={() => setIndex(index - 1)}
          >
            Önceki
          </Button>
          <Button
            variant="outline"
            disabled={!hasNext || loading}
            onClick={next}
          >
            {!rows.length && hasNext ? "Devam" : "Sonraki"}
          </Button>
        </div>
      </div>
    </div>
  );
}
