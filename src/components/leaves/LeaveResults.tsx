import { useEffect, useRef, useState } from "react";
import { usePaginatedQuery } from "convex/react";
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

export type LeaveQueryFilters = Omit<FunctionArgs<typeof api.leaves.listPage>, "paginationOpts">;
function LeaveSummary({ filters, onProjectRecords }: { filters: LeaveQueryFilters; onProjectRecords: (value: boolean) => void }) {
  const { results, status, loadMore } = usePaginatedQuery(api.leaves.summary, filters, { initialNumItems: 500 });
  useEffect(() => { if (status === "CanLoadMore") loadMore(500); }, [status, loadMore]);
  useEffect(() => { if (results[0]) onProjectRecords(results[0].projectHasRecords); }, [results, onProjectRecords]);
  return <p className="text-sm text-muted-foreground" role="status">{status === "Exhausted" ? `${results.reduce((count, page) => count + page.recordCount, 0)} kayıt · ${new Set(results.flatMap(page => page.employeeIds)).size} kişi` : "İzin özeti hesaplanıyor…"}</p>;
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
  const [projectHasRecords, setProjectHasRecords] = useState(true);
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
        <LeaveSummary filters={filters} onProjectRecords={setProjectHasRecords} />
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
      ) : (
        <EmptyState title={projectHasRecords ? "Bu filtrelerle eşleşen izin yok." : "Henüz izin kaydı yok."}
          description={projectHasRecords ? "Kişi, tür veya dönemi değiştirin." : "Bu proje için izin kaydı eklenmedi."}
          action={projectHasRecords ? { label: "Filtreleri temizle", onClick: onClear } : isAdmin ? { label: "İzin ekle", onClick: onCreate } : undefined} />
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
        nextLabel="Sonraki"
        pageSize={pageSize}
        pageSizes={[25, 50]}
        onPageSizeChange={onPageSizeChange}
        pageSizeLabel="Sayfadaki izin sayısı"
      />
    </div>
  );
}
