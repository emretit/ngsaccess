import { usePermissions } from "@/hooks/usePermissions";
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
import { VisitorFilters, type VisitorStatusFilter } from "./VisitorFilters";
import { displayVisitorStatus, isVisitorStatus } from "./lib/status";
import { VisitorStats } from "./VisitorStats";
import VisitorTable from "./VisitorTable";
import VisitorSlideOverPanel from "./VisitorSlideOverPanel";
import VisitorZoneDialog from "./VisitorZoneDialog";
import { useVisitorClock } from "./hooks/useVisitorClock";
import { useStableQuery } from "./hooks/useStableQuery";
import { PaginationBar } from "@/components/shared/PaginationBar";

export default function VisitorManagement() {
  const { projectId, loading, isSuperAdmin, activeProject } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("visitors.manage");
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const rawStatus = params.get("status");
  const status: VisitorStatusFilter = isVisitorStatus(rawStatus) ? rawStatus : "all";
  const [pageSize, setPageSize] = useState(25);
  const [panel, setPanel] = useState<{ visitor: Visitor | null; projectId: typeof projectId } | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const { now, onNextExpiry } = useVisitorClock();
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
      primaryAction={canManage && projectId ? { label: "Ziyaretçi kaydet", onClick: () => setPanel({ visitor: null, projectId }) } : undefined} />
    {loading ? <SectionSkeleton rows={6} label="Ziyaretçiler yükleniyor" /> : !projectId ? !isSuperAdmin ? <AccessDenied compact /> : <EmptyState title="Proje seçin" description="Ziyaretçileri görmek için erişiminiz olan aktif bir proje seçin." /> : <>
      <QuerySectionBoundary title="Ziyaretçi özeti yüklenemedi" resetKey={projectId}><VisitorStats now={now} onNextExpiry={onNextExpiry} /></QuerySectionBoundary>
      <VisitorFilters searchQuery={search} onSearchChange={q => filter(q, status, true)} statusFilter={status} onStatusFilterChange={value => filter(search, value)} onClear={clear} onNewZone={can("devices.manage") ? () => setZoneOpen(true) : undefined} />
      <QuerySectionBoundary title="Ziyaretçiler yüklenemedi" description="Bağlantınızı kontrol edip tekrar deneyin." resetKey={resetKey}>
        <VisitorList key={resetKey} search={search} status={status} pageSize={pageSize} onPageSizeChange={setPageSize} now={now} onOpen={visitor => setPanel({ visitor, projectId })} onClear={clear} />
      </QuerySectionBoundary>
      {panel && panel.projectId === projectId && <VisitorSlideOverPanel key={`${projectId}:${panel.visitor?._id ?? "new"}`} isOpen onClose={() => setPanel(null)} visitor={panel.visitor} onSave={() => setPanel(null)} now={now} canManage={canManage} />}
      {zoneOpen && <QuerySectionBoundary title="Erişim bölgeleri yüklenemedi" resetKey={projectId}><VisitorZoneDialog isOpen onClose={() => setZoneOpen(false)} /></QuerySectionBoundary>}
    </>}
  </div>;
}

export function VisitorList({ search, status, pageSize, onPageSizeChange, now, onOpen, onClear }: {
  search: string; status: VisitorStatusFilter; pageSize: number; onPageSizeChange: (value: number) => void; now: number;
  onOpen: (visitor: Visitor) => void; onClear: () => void;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const result = useVisitors({ search, status: status === "all" ? undefined : status, cursor, pageSize, now });
  // Project/filter changes remount VisitorList via resetKey; pagination resets this cache too.
  const page = useStableQuery(result.page, JSON.stringify([search, status, pageSize, cursor]));
  if (!page) return <SectionSkeleton rows={6} label="Ziyaretçiler yükleniyor" />;
  const visitors = page.page.map(visitor => ({ ...visitor, status: displayVisitorStatus(visitor, now) }));
  const filtered = !!search.trim() || status !== "all";
  return <div className="min-w-0 space-y-3">
    {visitors.length ? <VisitorTable visitors={visitors} onOpen={onOpen} /> : <EmptyState
      title={filtered ? "Eşleşen ziyaretçi yok" : cursors.length === 1 && page.isDone ? "Henüz ziyaretçi kaydı yok" : "Bu sayfada ziyaretçi kaydı yok"}
      description={filtered ? "Aramayı veya durum filtrelerini değiştirin." : "Bu projede geçici erişim verilen ziyaretçiler burada görünür."}
      action={filtered ? { label: "Filtreleri temizle", onClick: onClear } : undefined} />}
    {visitors.length > 0 && <PaginationBar summary={`Sayfa ${cursors.length} · ${visitors.length} kayıt`} page={cursors.length}
      onPrevious={() => setCursors(previous => previous.slice(0, -1))} onNext={() => setCursors(previous => [...previous, page.continueCursor])} nextDisabled={page.isDone}
      pageSize={pageSize} pageSizes={[25, 50]} onPageSizeChange={onPageSizeChange} pageSizeLabel="Sayfadaki ziyaretçi sayısı" />}
  </div>;
}
