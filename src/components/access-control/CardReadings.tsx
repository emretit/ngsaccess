import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { CardReadingsFilters } from "./CardReadingsFilters";
import { CardReadingsTable } from "./CardReadingsTable";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { Button } from "@/components/ui/button";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";
import { useFilteredReadings } from "@/components/live-monitoring/useFilteredReadings";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { readingSearchTerm } from "../../../convex/lib/readingSearch";
import { useLiveReadings } from "@/components/live-monitoring/useLiveReadings";
import { ReadingDetailPanel } from "@/components/live-monitoring/ReadingDetailPanel";
import { matches, readFilters, writeFilters, type Filters, type Reading } from "@/components/live-monitoring/lib/readings";

const OLDEST_DAY = "2000-01-01";
const PAGE_SIZES = [25, 50, 100] as const;
const previousDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
type OpenReading = (r: Reading, trigger: HTMLElement) => void;
type Range = { startDate?: string; endDate?: string };

/** Canlı satırların altına sunucu filtreli eski kayıtları ekler; tekrar eden okumalar bir kez gösterilir. */
function ReadingList({ projectId, filters, search, range, liveRows, freshIds, onOpen }: { projectId: Id<"projects">; filters: Filters; search?: string; range: Range; liveRows: Reading[]; freshIds: ReadonlySet<string>; onOpen: OpenReading }) {
  // URL kimlikleri sorgu argümanına girmeden seçili projenin seçenekleriyle doğrulanır.
  const devices = useQuery(api.devices.list, { projectId });
  const doors = useQuery(api.doors.list, { projectId });
  const people = useQuery(api.cardReadings.searchMonitoringPeople, { projectId, search: "", selectedId: filters.employee ? filters.employee : undefined });
  const device = devices?.find(d => d._id === filters.device);
  const door = doors?.find(d => d._id === filters.door);
  const employee = people?.find(p => p._id === filters.employee);
  const ready = Boolean(devices && doors && people);
  const badDate = Boolean(filters.start && filters.end && filters.start > filters.end);
  const history = useFilteredReadings(ready && !badDate ? {
    projectId, deviceId: device?._id, doorId: door?._id, employeeId: employee?._id,
    source: filters.source === "all" ? undefined : filters.source, result: filters.result === "all" ? undefined : filters.result, search, ...range,
  } : undefined);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const liveIds = new Set(liveRows.map(r => r._id));
  const readings = [...liveRows, ...history.rows.filter(r => !liveIds.has(r._id))];
  const loadedPages = Math.max(1, Math.ceil(readings.length / pageSize));
  // İstenen sayfa yüklenenleri aşınca eski kayıtlar sayfa dolana ya da kayıt bitene kadar çekilir.
  const waiting = !badDate && page > loadedPages && !history.isDone;
  const { loading: historyLoading, loadMore } = history;
  useEffect(() => { if (waiting && !historyLoading) loadMore(); }, [waiting, historyLoading, loadMore]);
  if (badDate) return <p id="reading-date-error" role="alert" className="text-xs text-danger">Bitiş tarihi başlangıçtan önce olamaz.</p>;
  if (!readings.length) {
    if (history.loading) return <SectionSkeleton rows={6} label="Erişim okumaları yükleniyor" />;
    return <div className="min-w-0 space-y-3">
      <CardReadingsTable readings={readings} onOpen={onOpen} emptyMessage={history.isDone ? "Seçili kapsamda okuma yok." : "Yüklenen kayıtlarda eşleşme yok. Daha eski kayıtlarda olabilir."} />
      {!history.isDone && <Button variant="outline" onClick={history.loadMore}>Daha eski kayıtlarda ara</Button>}
    </div>;
  }
  const currentPage = Math.min(page, loadedPages);
  return <CardReadingsTable readings={readings.slice((currentPage - 1) * pageSize, currentPage * pageSize)} freshIds={freshIds} onOpen={onOpen} footer={<PaginationBar
    summary={`${readings.length}${history.isDone ? "" : "+"} okuma · ${pageRange(readings.length, currentPage, pageSize)} gösteriliyor`}
    page={currentPage} pageCount={history.isDone ? loadedPages : undefined}
    onPrevious={() => setPage(currentPage - 1)} onNext={() => setPage(currentPage + 1)}
    nextDisabled={history.isDone ? currentPage >= loadedPages : waiting} nextLabel={waiting ? "Yükleniyor…" : "Sonraki"}
    pageSize={pageSize} pageSizes={PAGE_SIZES} onPageSizeChange={size => { setPageSize(size); setPage(1); }} pageSizeLabel="Sayfadaki okuma sayısı" />} />;
}
function Readings({ projectId, filters, onOpen }: { projectId: Id<"projects">; filters: Filters; onOpen: OpenReading }) {
  const dated = Boolean(filters.start || filters.end);
  const feed = useLiveReadings(projectId, !dated, filters.source);
  // Arama sunucuda yapılır; her tuşta sorgu açılmasın diye kısa gecikmeyle uygulanır.
  const search = readingSearchTerm(useDebouncedValue(filters.search));
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const previousIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!feed.initialized) { previousIds.current = null; setFreshIds(new Set()); return; }
    const before = previousIds.current;
    previousIds.current = new Set(feed.rows.map(r => r._id));
    if (!before) return;
    setFreshIds(new Set(feed.rows.filter(r => !before.has(r._id)).map(r => r._id)));
    const timer = window.setTimeout(() => setFreshIds(new Set()), 2000);
    return () => window.clearTimeout(timer);
  }, [feed.rows, feed.initialized]);
  if (!dated && feed.loading) return <SectionSkeleton rows={6} label="Erişim okumaları yükleniyor" />;
  // Bugün canlı akışta tamsa eski kayıtlar dünde biter; sorgu bugünkü yeni okumalarla yeniden çalışmaz.
  const range: Range = dated ? { startDate: filters.start || undefined, endDate: filters.end || undefined } : feed.truncated ? {} : { startDate: OLDEST_DAY, endDate: previousDay(feed.day) };
  const liveRows = dated ? [] : feed.rows.filter(r => matches(r, { ...filters, search: search ?? "" }));
  return <ReadingList key={`${filters.device}:${filters.employee}:${filters.door}:${filters.result}:${search}:${range.startDate}:${range.endDate}`} projectId={projectId} filters={filters} search={search} range={range} liveRows={liveRows} freshIds={freshIds} onOpen={onOpen} />;
}
function ProjectReadings({ projectId }: { projectId: Id<"projects"> }) {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params, projectId);
  const trigger = useRef<HTMLElement | null>(null);
  const [activeReading, setActiveReading] = useState<string | null>(params.get("reading"));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const { requestClose: requestRouteClose, dialog: routeDialog } = useUnsavedChangesGuard(dirty);
  const change = useCallback((next: Partial<Filters>) => setParams(current => writeFilters(current, { ...readFilters(current, projectId), ...next }, projectId), { replace: true }), [projectId, setParams]);
  const writeReading = useCallback((id: string | null, replace: boolean) => setParams(current => { const next = new URLSearchParams(current); if (id) next.set("reading", id); else next.delete("reading"); return next; }, replace ? { replace: true } : undefined), [setParams]);
  const open = (r: Reading, anchor: HTMLElement) => { trigger.current = anchor; setActiveReading(r._id); writeReading(r._id, false); };
  const close = () => { setActiveReading(null); setDirty(false); writeReading(null, true); };
  const reading = params.get("reading");
  // Router URL'yi transition ile geç günceller; yalnız URL değişince (geri/ileri) senkronla, aksi halde open() paneli anında kapatır.
  const syncedReading = useRef(reading);
  useEffect(() => {
    if (reading === syncedReading.current) return;
    syncedReading.current = reading;
    if (reading === activeReading) return;
    const move = () => { setDirty(false); setActiveReading(reading); writeReading(reading, true); };
    if (dirty || pending) {
      writeReading(activeReading, true);
      if (!pending) requestRouteClose(move);
    } else move();
  }, [reading, activeReading, dirty, pending, requestRouteClose, writeReading]);
  useEffect(() => { if (params.get("liveProject") && params.get("liveProject") !== projectId) setParams(current => { const next = writeFilters(current, readFilters(current, projectId), projectId); next.delete("reading"); return next; }, { replace: true }); }, [projectId, params, setParams]);
  return <div className="min-w-0 space-y-4">
    <CardReadingsFilters projectId={projectId} filters={filters} change={change} />
    <QuerySectionBoundary resetKey={`${projectId}:${filters.device}:${filters.employee}:${filters.door}:${filters.result}:${filters.source}:${filters.start}:${filters.end}`} description="Okumalar yüklenemedi. Filtreleriniz korunuyor.">
      <Readings key={`${filters.source}:${Boolean(filters.start || filters.end)}`} projectId={projectId} filters={filters} onOpen={open} />
    </QuerySectionBoundary>
    {activeReading && <ReadingDetailPanel key={activeReading} readingId={activeReading} onClose={close} trigger={trigger} onDirtyChange={setDirty} onPendingChange={setPending} />}
    {routeDialog}
  </div>;
}
export default function CardReadings() {
  const { projectId, loading } = useActiveProjectScope();
  if (loading) return <SectionSkeleton rows={6} label="Proje yükleniyor" />;
  if (!projectId) return <EmptyState title="Proje seçin" description="Okumaları görmek için üst çubuktan bir proje seçin." />;
  return <ProjectReadings key={projectId} projectId={projectId} />;
}
