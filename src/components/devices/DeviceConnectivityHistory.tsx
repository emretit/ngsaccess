import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Metric } from "./DeviceCenterMetric";

export function connectivityDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes === 0) return "1 dk'dan az";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} sa${minutes % 60 ? ` ${minutes % 60} dk` : ""}` : `${minutes} dk`;
}

export function connectivityTime(ms: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(ms);
}

export function DeviceConnectivityHistory({ deviceId, current }: {
  deviceId: Id<"devices">;
  current?: { now: number; since: number | undefined };
}) {
  const history = useQuery(api.deviceEvents.getConnectivityHistory, { deviceId });
  // Mevcut cihaz merkezi saatini kullanır; ek timer veya sunucu polling'i yok.
  // Kart okutunca sinyal veren cihazda (Hik gateway) sessizlik kesinti değildir: yalnız sunucunun açık dönemi.
  const since = history?.periodicHeartbeat === false || !current ? history?.ongoing?.since : current.since;
  const now = current?.now ?? history?.asOf ?? 0;
  const ongoingMs = since === undefined ? 0 : Math.max(0, now - Math.max(since, now - 30 * 86400000));
  const snapshotOngoingMs = history?.ongoing
    ? Math.max(0, history.asOf - Math.max(history.ongoing.since, history.asOf - 30 * 86400000)) : 0;
  const count = history ? history.count - (history.ongoing ? 1 : 0) + (since === undefined ? 0 : 1) : 0;
  const totalMs = history ? Math.max(0, history.totalMs - snapshotOngoingMs + ongoingMs) : 0;
  const longestMs = Math.max(history?.longestMs ?? 0, ongoingMs);
  return (
    <section aria-label="Bağlantı geçmişi" className="mt-5 space-y-3 border-t border-line pt-5">
      <div>
        <h3 className="text-base font-semibold">Bağlantı geçmişi</h3>
        <p className="text-xs text-muted-foreground">Son 30 gün · İstanbul saati (UTC+3)</p>
      </div>
      {history === undefined ? <p role="status" className="text-sm">Bağlantı geçmişi yükleniyor…</p> : <>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Çevrimdışı sayısı" value={String(count)} />
          <Metric label="Toplam süre" value={totalMs ? connectivityDuration(totalMs) : "0 dk"} />
          <Metric label="En uzun süre" value={longestMs ? connectivityDuration(longestMs) : "0 dk"} />
        </div>
        {count === 0 && <p className="text-sm text-muted-foreground">Son 30 günde çevrimdışı dönem yok</p>}
        {!history.periodicHeartbeat && <p className="text-xs text-muted-foreground">Bu cihaz yalnız kart okutulunca sinyal gönderir; kesinti yalnız gateway cihazı çevrimdışı bildirdiğinde kaydedilir.</p>}
        {since !== undefined && <p className="text-sm text-warning">
          {connectivityTime(since)} — devam ediyor
        </p>}
        {history.periods.length > 0 && <ol aria-label="Son çevrimdışı dönemler" className="space-y-2 text-sm">
          {history.periods.map((period, index) => <li key={`${period.offlineTo}-${index}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <span>{connectivityTime(period.offlineFrom)} — {connectivityTime(period.offlineTo)}</span>
            <span className="text-muted-foreground">{connectivityDuration(period.durationMs)}</span>
          </li>)}
        </ol>}
        {history.truncated && <p className="text-xs text-muted-foreground">Hesaplama son 500 dönem ile sınırlı; listede son 20 tamamlanan dönem gösterilir.</p>}
      </>}
    </section>
  );
}
