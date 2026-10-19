import { useEffect, useRef, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { PaginationBar } from "@/components/shared/PaginationBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { LeaveList } from "./LeaveList";
import {
  boundaryFor,
  pageSlice,
  type LeavePageBoundary,
  type LeaveRow,
} from "./lib/leaveState";

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
  onPageSizeChange,
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
  onPageSizeChange?: (size: number) => void;
}) {
  // Convex manages splitCursor / SplitRequired internally, including empty candidate pages.
  const { results, status, loadMore } = usePaginatedQuery(
    api.leaves.listPage,
    filters,
    { initialNumItems: pageSize },
  );
  // Sayfa sınırları sıra numarası değil kayıt kimliğiyle tutulur: liste canlı
  // güncellenirken (ekleme/silme) sayfalar kaymaz, kayıt tekrarlanmaz veya atlanmaz.
  const [boundaries, setBoundaries] = useState<LeavePageBoundary[]>([]);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<LeavePageBoundary | null>(null);
  useEffect(() => {
    if (pending === null) return;
    if (status !== "CanLoadMore" && status !== "Exhausted") return;
    setBoundaries((previous) => [...previous, pending]);
    setIndex((previous) => previous + 1);
    setPending(null);
  }, [status, pending]);
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
  const rows = pageSlice(results, boundaries, index, pending);
  const loading = status === "LoadingMore" || pending !== null;
  const hasNext = index < boundaries.length || status === "CanLoadMore";
  const next = () => {
    if (index < boundaries.length) setIndex(index + 1);
    else if (status === "CanLoadMore" && pending === null) {
      setPending(boundaryFor(results));
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
      ) : hasNext || boundaries.length > 0 ? (
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

      <PaginationBar
        summary={
          loading
            ? "İzin kayıtları yükleniyor…"
            : `${index + 1}. sayfa · ${rows.length} kayıt gösteriliyor`
        }
        page={index + 1}
        onPrevious={() => setIndex(index - 1)}
        onNext={next}
        previousDisabled={index === 0 || loading}
        nextDisabled={!hasNext || loading}
        nextLabel={!rows.length && hasNext ? "Devam" : "Sonraki"}
        pageSize={pageSize}
        pageSizes={[25, 50]}
        onPageSizeChange={onPageSizeChange}
        pageSizeLabel="Sayfadaki izin sayısı"
      />
    </div>
  );
}
