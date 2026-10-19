import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { StatInline } from "@/components/shared/StatInline";
import { Button } from "@/components/ui/button";
import { watchReadingScroll } from "@/components/live-monitoring/lib/scroll";
import { useFilteredReadings } from "@/components/live-monitoring/useFilteredReadings";
import { useLiveReadings } from "@/components/live-monitoring/useLiveReadings";
import { LiveFeedControls } from "@/components/live-monitoring/LiveFeedControls";
import { ReadingDetailPanel } from "@/components/live-monitoring/ReadingDetailPanel";
import { matches, readFilters, writeFilters, trTime, type Filters, type Reading } from "@/components/live-monitoring/lib/readings";

function History({ projectId, filters, onOpen, filterBar }: { projectId: Id<"projects">; filters: Filters; onOpen: (r: Reading, trigger: HTMLElement) => void; filterBar: ReactNode }) {
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
    source: filters.source === "all" ? undefined : filters.source, result: filters.result === "all" ? undefined : filters.result, startDate: filters.start || undefined, endDate: filters.end || undefined,
  } : undefined);
  const term = filters.search.trim().toLocaleLowerCase("tr-TR");
  const readings = history.rows.filter(r => !term || `${r.employeeName ?? ""} ${r.cardNo}`.toLocaleLowerCase("tr-TR").includes(term));
  return <div className="min-w-0 space-y-4"><StatInline loading={history.loading && !history.rows.length} items={[{ label: "Yüklenen", value: history.rows.length }, { label: "Gösterilen", value: readings.length }]} />
    {filterBar}
    {badDate ? <p id="reading-date-error" role="alert" className="text-xs text-danger">Bitiş tarihi başlangıçtan önce olamaz.</p> : <>
      <p className="text-xs text-muted-foreground">{history.scannedCount} kayıt tarandı, {history.rows.length} eşleşti, {readings.length} gösteriliyor. Daha eski kayıtlar için “Daha eski kayıtları yükle” düğmesine basın.</p>
      {history.loading && !history.rows.length ? <SectionSkeleton rows={6} label="Erişim okumaları yükleniyor" /> : <CardReadingsTable readings={readings} onOpen={onOpen} emptyMessage={!history.isDone ? "Yüklenen kayıtlarda eşleşme yok. Daha eski kayıtlarda olabilir; taramaya devam edin." : "Seçili kapsamda eşleşme bulunamadı."} />}
      {history.isDone ? <p className="text-xs text-muted-foreground">Seçili kapsamın tüm kayıtları yüklendi.</p> : <Button variant="outline" disabled={history.loading} onClick={history.loadMore}>{history.loading ? "Yükleniyor…" : "Daha eski kayıtları yükle"}</Button>}
    </>}
  </div>;
}
function Live({ projectId, filters, onOpen, filterBar }: { projectId: Id<"projects">; filters: Filters; onOpen: (r: Reading, trigger: HTMLElement) => void; filterBar: ReactNode }) {
  const feed = useLiveReadings(projectId, filters.mode === "live", filters.source);
  const lastReading = useQuery(api.cardReadings.lastMonitoringReading, { projectId });
  const [params] = useSearchParams();
  const readingId = params.get("reading");
  const pause = feed.pause;
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const previousIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!feed.initialized) { previousIds.current = null; setFreshIds(new Set()); return; }
    const before = previousIds.current;
    previousIds.current = new Set(feed.snapshot.map(r => r._id));
    if (!before) return;
    setFreshIds(new Set(feed.snapshot.filter(r => !before.has(r._id)).map(r => r._id)));
    const timer = window.setTimeout(() => setFreshIds(new Set()), 2000);
    return () => window.clearTimeout(timer);
  }, [feed.snapshot, feed.initialized]);
  useEffect(() => { if (readingId) pause(); }, [readingId, pause, feed.paused]); // Ayrıntı kapanınca otomatik devam edilmez.
  useEffect(() => watchReadingScroll(document.querySelector("main"), pause), [pause]);
  const visible = feed.snapshot.filter(r => matches(r, filters));
  const shownIds = new Set(feed.snapshot.map(r => r._id));
  const count = feed.buffer.filter(r => !shownIds.has(r._id) && matches(r, filters)).length;
  return <div className="min-w-0 space-y-4"><LiveFeedControls paused={feed.paused} count={count} reloadRequired={feed.reloadRequired} onPause={feed.pause} onApply={feed.apply} onReload={feed.reload} lastEvent={lastReading ? trTime(lastReading.accessTime) : undefined} />
    <StatInline loading={feed.loading} items={[{ label: "Yüklenen", value: feed.snapshot.length }, { label: "Gösterilen", value: visible.length }]} />
    {filterBar}
    {feed.scanInfo && <p className="text-xs text-muted-foreground">Son tarama: {feed.scanInfo.scannedCount} kayıt tarandı, {feed.scanInfo.matchedCount} eşleşti.{feed.scanInfo.scanLimitReached ? " Tarama sınırına ulaşıldı; tüm kayıtlar için Geçmiş görünümünde devam edin." : ""}</p>}
    <p className="text-xs text-muted-foreground">Bugün Türkiye saatine göre sunucuya alınan, seçili kaynağa uyan en fazla 500 kayıt. Olay zamanı daha eski olabilir. Kaynak filtresi sunucuda uygulanır. Diğer filtreler yalnız yüklenen canlı kayıtlarda uygulanır; tüm geçmiş için Geçmiş görünümüne geçin.</p>
    {feed.loading ? <SectionSkeleton rows={6} label="Erişim okumaları yükleniyor" /> : <div onFocusCapture={feed.pause} onPointerDownCapture={feed.pause}><CardReadingsTable live={feed.snapshot.length === 0 && filters.source === "all"} readings={visible} freshIds={freshIds} onOpen={(r, trigger) => { feed.pause(); onOpen(r, trigger); }} emptyMessage={feed.snapshot.length ? "Yüklenen kayıtlarda eşleşme yok. Geçmiş görünümünde daha eski kayıtları arayabilirsiniz." : undefined} /></div>}
  </div>;
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
  const filterBar = <CardReadingsFilters projectId={projectId} filters={filters} change={change} />;
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Görünüm"><Button variant="outline" className="aria-pressed:border-primary aria-pressed:bg-selected aria-pressed:text-primary aria-pressed:font-semibold aria-pressed:hover:bg-selected" aria-pressed={filters.mode === "live"} onClick={() => change({ mode: "live", start: "", end: "" })}>Canlı</Button><Button variant="outline" className="aria-pressed:border-primary aria-pressed:bg-selected aria-pressed:text-primary aria-pressed:font-semibold aria-pressed:hover:bg-selected" aria-pressed={filters.mode === "history"} onClick={() => change({ mode: "history" })}>Geçmiş</Button></div>
    <QuerySectionBoundary resetKey={`${projectId}:${filters.mode}:${filters.device}:${filters.employee}:${filters.door}:${filters.result}:${filters.source}:${filters.start}:${filters.end}`} description="Okumalar yüklenemedi. Filtreleriniz korunuyor.">
      {filters.mode === "live" ? <Live key={filters.source} projectId={projectId} filters={filters} onOpen={open} filterBar={filterBar} /> : <History key={`${filters.device}:${filters.employee}:${filters.door}:${filters.result}:${filters.source}:${filters.start}:${filters.end}`} projectId={projectId} filters={filters} onOpen={open} filterBar={filterBar} />}
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
