import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FilterBar } from "@/components/shared/FilterBar";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { emptyFilters, type Filters } from "@/components/live-monitoring/lib/readings";
import { DateInput } from "@/components/ui/date-picker";

function Options({ projectId, filters, change }: { projectId: Id<"projects">; filters: Filters; change: (next: Partial<Filters>) => void }) {
  const devices = useQuery(api.devices.list, { projectId });
  const doors = useQuery(api.doors.list, { projectId });
  const people = useQuery(api.employees.list, { projectId });
  useEffect(() => {
    const patch: Partial<Filters> = {};
    if (devices && filters.device && !devices.some(d => d._id === filters.device)) patch.device = "";
    if (people && filters.employee && !people.some(p => p._id === filters.employee)) patch.employee = "";
    if (doors && filters.door && !doors.some(d => d._id === filters.door && (!filters.device || d.deviceId === filters.device))) patch.door = "";
    if (Object.keys(patch).length) change(patch);
  }, [devices, doors, people, filters.device, filters.employee, filters.door, change]);
  const selectClass = "h-9 w-full min-w-0 rounded-md border border-control bg-surface px-2 text-xs min-[761px]:w-44";
  return <>
    <label className="grid min-w-0 gap-1 text-xs">Cihaz<select className={selectClass} value={filters.device} onChange={e => change({ device: e.target.value, door: "" })}><option value="">Tüm cihazlar</option>{devices?.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
    <label className="grid min-w-0 gap-1 text-xs">Sonuç<select className={selectClass} value={filters.result} onChange={e => { const result = e.target.value; if (result === "all" || result === "granted" || result === "denied" || result === "unknown") change({ result }); }}><option value="all">Tüm sonuçlar</option><option value="granted">İzin verildi</option><option value="denied">Reddedildi</option><option value="unknown">Sonuç bilinmiyor</option></select></label>
    <details className="w-full min-w-0"><summary className="cursor-pointer py-2 text-xs">Diğer filtreler · Kapı, kişi ve tarih</summary><div className="grid min-w-0 gap-3 py-3 min-[761px]:grid-cols-4">
      <label className="grid min-w-0 gap-1 text-xs">Kapı<select className={selectClass} value={filters.door} onChange={e => { const door = doors?.find(d => d._id === e.target.value); change({ door: e.target.value, device: door?.deviceId ?? filters.device }); }}><option value="">Tüm kapılar</option>{doors?.filter(d => !filters.device || d.deviceId === filters.device).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-xs">Kişi<select className={selectClass} value={filters.employee} onChange={e => change({ employee: e.target.value })}><option value="">Tüm kişiler</option>{people?.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-xs">Başlangıç (TR günü)<DateInput className="min-w-0" value={filters.start} onChange={start => change({ start, mode: "history" })} /></label>
      <label className="grid min-w-0 gap-1 text-xs">Bitiş (TR günü)<DateInput className="min-w-0" value={filters.end} aria-describedby="reading-date-error" onChange={end => change({ end, mode: "history" })} /></label>
    </div></details>
  </>;
}
export function CardReadingsFilters({ projectId, filters, change }: { projectId: Id<"projects">; filters: Filters; change: (next: Partial<Filters>) => void }) {
  return <div className="min-w-0 space-y-2">
    <FilterBar search={filters.search} onSearchChange={search => change({ search })} searchLabel="Yüklenen kayıtlarda kişi veya kart ara" placeholder="Yüklenen kayıtlarda kişi/kart ara" hasFilters={Object.entries(filters).some(([key, value]) => key !== "mode" && value !== emptyFilters[key as keyof Filters])} onClear={() => change({ ...emptyFilters, mode: filters.mode })} />
    <QuerySectionBoundary resetKey={projectId} description="Filtre seçenekleri yüklenemedi. Arama korunuyor."><div className="grid min-w-0 gap-3 min-[761px]:flex min-[761px]:flex-wrap min-[761px]:items-end"><Options projectId={projectId} filters={filters} change={change} /></div></QuerySectionBoundary>
  </div>;
}
