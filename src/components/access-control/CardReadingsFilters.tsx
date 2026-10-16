import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ScanLine } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseDateString, toLocalDateString, todayInTurkey } from "@/lib/date";
import type { useCardReadings } from "@/hooks/useCardReadings";
import type { Id } from "../../../convex/_generated/dataModel";

type CardReadingsFiltersProps = Pick<ReturnType<typeof useCardReadings>,
  "searchTerm" | "setSearchTerm" | "dateFilter" | "setDateFilter" | "endDateFilter" | "setEndDateFilter" |
  "accessFilter" | "setAccessFilter" | "deviceId" | "setDeviceId" | "devices" | "hasMore" | "isLoading"
> & { loadedCount: number };

export const CardReadingsFilters = ({ searchTerm, setSearchTerm, dateFilter, setDateFilter,
  endDateFilter, setEndDateFilter, accessFilter, setAccessFilter, deviceId, setDeviceId,
  devices, loadedCount, hasMore, isLoading }: CardReadingsFiltersProps) => (
  <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6 space-y-3">
    <div className="flex items-center gap-2">
      <ScanLine className="h-4 w-4 text-primary" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-semibold">Kart Okutma Geçmişi</h2>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {isLoading ? "Kayıtlar yükleniyor…" : `${loadedCount} kayıt yüklendi${hasMore ? " · Daha eski kayıtlar var" : ""}`} · TR saati
        </p>
      </div>
    </div>
    <div className="flex items-end gap-3 flex-wrap">
      <label className="flex-1 min-w-[200px] space-y-1 text-xs">
        <span>Yüklenen kayıtlarda arama</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input type="search" placeholder="Personel veya kart no…" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      </label>
      <label className="space-y-1 text-xs"><span>Başlangıç (TR günü)</span>
        <Input type="date" value={dateFilter ? toLocalDateString(dateFilter) : ""}
          onChange={e => setDateFilter(parseDateString(e.target.value))} className="h-8" />
      </label>
      <label className="space-y-1 text-xs"><span>Bitiş (TR günü)</span>
        <Input type="date" value={endDateFilter ? toLocalDateString(endDateFilter) : ""}
          onChange={e => setEndDateFilter(parseDateString(e.target.value))} className="h-8" />
      </label>
      <Button variant="outline" size="sm" onClick={() => { setDateFilter(parseDateString(todayInTurkey())); setEndDateFilter(undefined); }}>Bugün</Button>
      <Select value={deviceId ?? "all"} onValueChange={value => setDeviceId(value === "all" ? undefined : value as Id<"devices">)}>
        <SelectTrigger aria-label="Cihaz" className="w-[180px] h-8 text-xs"><SelectValue placeholder="Tüm cihazlar" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Tüm cihazlar</SelectItem>
          {devices.map(device => <SelectItem key={device._id} value={device._id}>{device.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={accessFilter} onValueChange={value => { if (value === "all" || value === "granted" || value === "denied") setAccessFilter(value); }}>
        <SelectTrigger aria-label="Geçiş sonucu" className="w-[140px] h-8 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Tüm sonuçlar</SelectItem><SelectItem value="granted">İzin Verilenler</SelectItem><SelectItem value="denied">Reddedilenler</SelectItem></SelectContent>
      </Select>
    </div>
    {!endDateFilter && <p className="text-xs text-muted-foreground">Bitiş boşsa yalnız başlangıç günü</p>}
  </div>
);
