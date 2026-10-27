import { useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FilterBar } from "@/components/shared/FilterBar";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { emptyFilters, type Filters } from "@/components/live-monitoring/lib/readings";
import { MonitoringPersonPicker } from "@/components/live-monitoring/MonitoringPersonPicker";
import { DateInput } from "@/components/ui/date-picker";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
const FIELD = "grid w-full min-w-0 gap-1 text-xs min-[761px]:w-40";
function FilterSelect({ label, value, change, children }: { label: string; value: string; change: (value: string) => void; children: ReactNode }) {
  return <div className={FIELD}><span>{label}</span><Select value={value || "all"} onValueChange={change}><SelectTrigger aria-label={label} className="w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></div>;
}
function Options({ projectId, filters, change }: { projectId: Id<"projects">; filters: Filters; change: (next: Partial<Filters>) => void }) {
  const badDate = Boolean(filters.start && filters.end && filters.start > filters.end);
  const devices = useQuery(api.devices.list, { projectId });
  const doors = useQuery(api.doors.list, { projectId });
  useEffect(() => {
    const patch: Partial<Filters> = {};
    if (devices && filters.device && !devices.some(d => d._id === filters.device)) patch.device = "";
    if (doors && filters.door && !doors.some(d => d._id === filters.door && (!filters.device || d.deviceId === filters.device))) patch.door = "";
    if (Object.keys(patch).length) change(patch);
  }, [devices, doors, filters.device, filters.door, change]);
  return <>
    <FilterSelect label="Cihaz" value={filters.device} change={value => change({ device: value === "all" ? "" : value, door: "" })}><SelectItem value="all">Tüm cihazlar</SelectItem>{devices?.map(d => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}</FilterSelect>
    <FilterSelect label="Kapı" value={filters.door} change={value => { const door = doors?.find(d => d._id === value); change({ door: value === "all" ? "" : value, device: door?.deviceId ?? filters.device }); }}><SelectItem value="all">Tüm kapılar</SelectItem>{doors?.filter(d => !filters.device || d.deviceId === filters.device).map(d => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}</FilterSelect>
    <div className={FIELD}><span>Kişi</span><MonitoringPersonPicker projectId={projectId} value={filters.employee} allowClear onChange={person => change({ employee: person?._id ?? "" })} /></div>
    <FilterSelect label="Sonuç" value={filters.result} change={result => { if (result === "all" || result === "granted" || result === "denied" || result === "unknown") change({ result }); }}><SelectItem value="all">Tüm sonuçlar</SelectItem><SelectItem value="granted">İzin verildi</SelectItem><SelectItem value="denied">Reddedildi</SelectItem><SelectItem value="unknown">Sonuç bilinmiyor</SelectItem></FilterSelect>
    <FilterSelect label="Kaynak" value={filters.source} change={source => { if (source === "all" || source === "card" || source === "qr" || source === "mobile" || source === "biometric") change({ source }); }}><SelectItem value="all">Tüm kaynaklar</SelectItem><SelectItem value="card">Kart</SelectItem><SelectItem value="qr">QR</SelectItem><SelectItem value="mobile">Mobil</SelectItem><SelectItem value="biometric">Biyometrik</SelectItem></FilterSelect>
    <label className={FIELD}>Başlangıç (TR günü)<DateInput className="min-w-0" value={filters.start} aria-invalid={badDate} aria-describedby={badDate ? "reading-date-error" : undefined} onChange={start => change({ start })} /></label>
    <label className={FIELD}>Bitiş (TR günü)<DateInput className="min-w-0" value={filters.end} aria-invalid={badDate} aria-describedby={badDate ? "reading-date-error" : undefined} onChange={end => change({ end })} /></label>
  </>;
}
export function CardReadingsFilters({ projectId, filters, change }: { projectId: Id<"projects">; filters: Filters; change: (next: Partial<Filters>) => void }) {
  return <FilterBar search={filters.search} onSearchChange={search => change({ search })} searchLabel="Kişi adı veya kart no ara" placeholder="Ad, soyad ya da tam kart no" hasFilters={Object.entries(filters).some(([key, value]) => value !== emptyFilters[key as keyof Filters])} onClear={() => change(emptyFilters)}>
    <QuerySectionBoundary className="contents" resetKey={projectId} description="Filtre seçenekleri yüklenemedi. Arama korunuyor."><Options projectId={projectId} filters={filters} change={change} /></QuerySectionBoundary>
  </FilterBar>;
}
