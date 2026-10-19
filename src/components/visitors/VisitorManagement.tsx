import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Visitor } from "@/types/visitor";
import { useVisitors } from "@/hooks/useVisitors";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";
import { VisitorFilters, type VisitorStatusFilter } from "./VisitorFilters";
import { isVisitorStatus } from "./lib/status";
import { VisitorStats } from "./VisitorStats";
import VisitorTable from "./VisitorTable";
import VisitorSlideOverPanel from "./VisitorSlideOverPanel";
import VisitorZoneDialog from "./VisitorZoneDialog";
import { useStableQuery } from "./hooks/useStableQuery";
import { PaginationBar } from "@/components/shared/PaginationBar";

export default function VisitorManagement() {
  const { projectId, loading, isAdmin, isSuperAdmin, activeProject } = useActiveProject();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const rawStatus = params.get("status");
  const status: VisitorStatusFilter = isVisitorStatus(rawStatus) ? rawStatus : "all";
  const [pageSize, setPageSize] = useState(25);
  const [panel, setPanel] = useState<{ visitor: Visitor | null; projectId: typeof projectId } | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey(Math.floor(Date.now() / 60000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setPanel(null); setZoneOpen(false); }, [projectId]);
  const filter = (q: string, nextStatus: VisitorStatusFilter, replace = false) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (q) next.set("q", q); else next.delete("q");
      if (nextStatus !== "all") next.set("status", nextStatus); else next.delete("status");
      return next;
    }, { replace });
  };
  const clear = () => filter("", "all");
  const resetKey = `${projectId}:${search}:${status}:${pageSize}`;
  return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <PageHeader title="Ziyaretçiler" scope={`${activeProject?.name ?? "Proje seçin"} · Geçici erişim kayıtları`}
      primaryAction={isAdmin && projectId ? { label: "Ziyaretçi kaydet", onClick: () => setPanel({ visitor: null, projectId }) } : undefined} />
    {loading ? <SectionSkeleton rows={6} label="Ziyaretçiler yükleniyor" /> : !projectId ? !isSuperAdmin ? <AccessDenied compact /> : <EmptyState title="Proje seçin" description="Ziyaretçileri görmek için erişiminiz olan aktif bir proje seçin." /> : <>
      <QuerySectionBoundary title="Ziyaretçi özeti yüklenemedi" resetKey={projectId}><VisitorStats refreshKey={refreshKey} /></QuerySectionBoundary>
      <QuerySectionBoundary title="Cihaz durumu yüklenemedi" resetKey={projectId}><div id="visitor-sync-status" tabIndex={-1} aria-label="Proje cihaz senkronizasyon durumu"><DeviceSyncStatusBanner /></div></QuerySectionBoundary>
      <VisitorFilters searchQuery={search} onSearchChange={q => filter(q, status, true)} statusFilter={status} onStatusFilterChange={value => filter(search, value)} onClear={clear} onNewZone={isAdmin ? () => setZoneOpen(true) : undefined} />
      <QuerySectionBoundary title="Ziyaretçiler yüklenemedi" description="Bağlantınızı kontrol edip tekrar deneyin." resetKey={resetKey}>
        <VisitorList key={resetKey} search={search} status={status} pageSize={pageSize} onPageSizeChange={setPageSize} refreshKey={refreshKey} onOpen={visitor => setPanel({ visitor, projectId })} onClear={clear} onCreate={isAdmin ? () => setPanel({ visitor: null, projectId }) : undefined} />
      </QuerySectionBoundary>
      {panel && panel.projectId === projectId && <VisitorSlideOverPanel key={`${projectId}:${panel.visitor?._id ?? "new"}`} isOpen onClose={() => setPanel(null)} visitor={panel.visitor} onSave={() => setPanel(null)} refreshKey={refreshKey} canManage={isAdmin} />}
      {zoneOpen && <QuerySectionBoundary title="Erişim bölgeleri yüklenemedi" resetKey={projectId}><VisitorZoneDialog isOpen onClose={() => setZoneOpen(false)} /></QuerySectionBoundary>}
    </>}
  </div>;
}

function VisitorList({ search, status, pageSize, onPageSizeChange, refreshKey, onOpen, onClear, onCreate }: {
  search: string; status: VisitorStatusFilter; pageSize: number; onPageSizeChange: (value: number) => void; refreshKey: number;
  onOpen: (visitor: Visitor) => void; onClear: () => void; onCreate?: () => void;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const result = useVisitors({ search, status: status === "all" ? undefined : status, cursor, pageSize, refreshKey });
  // Project/filter changes remount VisitorList via resetKey; pagination resets this cache too.
  const page = useStableQuery(result.page, JSON.stringify([search, status, pageSize, cursor]));
  if (!page) return <SectionSkeleton rows={6} label="Ziyaretçiler yükleniyor" />;
  const visitors = page.page;
  const filtered = !!search.trim() || status !== "all";
  return <div className="min-w-0 space-y-3">
    {visitors.length ? <VisitorTable visitors={visitors} onOpen={onOpen} /> : <EmptyState
      title={filtered ? "Bu sayfada eşleşen ziyaretçi yok" : cursors.length === 1 && page.isDone ? "Henüz ziyaretçi kaydı yok" : "Bu sayfada ziyaretçi kaydı yok"}
      description={filtered ? "Aramayı veya durum filtrelerini değiştirin. Diğer sayfalarda eşleşen kayıtlar olabilir." : "Bu projede geçici erişim verilen ziyaretçiler burada görünür."}
      action={filtered ? { label: "Filtreleri temizle", onClick: onClear } : onCreate ? { label: "Ziyaretçi kaydet", onClick: onCreate } : undefined} />}
    <PaginationBar summary={`Sayfa ${cursors.length} · ${page.scannedCount} kayıt tarandı · ${visitors.length} kayıt gösteriliyor`} page={cursors.length}
      onPrevious={() => setCursors(previous => previous.slice(0, -1))} onNext={() => setCursors(previous => [...previous, page.continueCursor])} nextDisabled={page.isDone}
      pageSize={pageSize} pageSizes={[25, 50]} onPageSizeChange={onPageSizeChange} pageSizeLabel="Sayfadaki ziyaretçi sayısı" />
  </div>;
}
