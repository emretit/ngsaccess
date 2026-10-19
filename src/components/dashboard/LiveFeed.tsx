import { Link } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useDashboardReadings } from "@/hooks/useDashboard";
import { useNow } from "@/hooks/useNow";
import { capabilities } from "@/lib/capabilities";
import { formatTrDateTime } from "@/lib/date";
import { feedTimeTr } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "./DashboardPanel";

const FEED_SIZE = 7;
const DIRECTION_LABEL = { entry: "Giriş", exit: "Çıkış" } as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
}

/** Son kart okumaları; yeni okuma geldikçe üstte belirir. */
export default function LiveFeed() {
  const { readings, loading } = useDashboardReadings(FEED_SIZE);
  const { profile } = useAuth();
  const now = useNow(30_000);
  const latestTime = Math.max(...readings.map(reading => Date.parse(reading.accessTime)).filter(Number.isFinite));
  const hasLatest = Number.isFinite(latestTime);
  const live = !loading && hasLatest && now - latestTime <= 60 * 60_000;
  return (
    <DashboardPanel
      title="Son okumalar"
      aside={
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {live ? <>
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full status-success-bg opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full status-success-bg" />
            </span>
            Canlı
          </> : loading ? "Yükleniyor" : hasLatest ? `Son okuma: ${formatTrDateTime(latestTime)}` : "Henüz okuma yok"}
        </span>
      }
      link={{ to: "/live-monitoring", label: "Tümü" }}
    >
      {loading ? (
        <SectionSkeleton rows={5} label="Son kart okumaları yükleniyor" className="p-4" />
      ) : !readings.length ? (
        <div className="pb-6">
          <EmptyState
            compact
            title="Henüz kart okuması yok"
            description={capabilities(profile?.role).admin ? "Cihaz ve personel bağlantılarını kontrol edin. İlk okuma burada görünür." : "Cihaz ve personel bağlantılarını yöneticinizle kontrol edin."}
          />
          <div className="flex flex-wrap justify-center gap-2 px-4">
            <Button asChild variant="outline"><Link to="/devices">Cihazları görüntüle</Link></Button>
            <Button asChild variant="outline"><Link to="/employees">Kişileri görüntüle</Link></Button>
          </div>
        </div>
      ) : (
        <ol aria-label="Son kart okumaları" className="divide-y">
          {readings.map((reading) => {
            const name = reading.employeeName?.trim();
            const device = reading.devices?.name?.trim() || "Cihaz bilgisi yok";
            const granted = reading.accessStatus === "izin_verildi";
            const denied = reading.accessStatus === "reddedildi";
            const direction = reading.direction ? DIRECTION_LABEL[reading.direction] : null;
            return (
              <li key={reading._id} className="flex items-center gap-3 px-4 py-2.5 animate-in fade-in duration-500 motion-reduce:animate-none min-[761px]:px-5">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-subtle text-[11px] font-semibold text-muted-foreground">
                  {name ? initials(name) : <CreditCard className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name || <>Kart <span className="tabular-nums">{reading.cardNo}</span><span className="sr-only"> (tanımsız)</span></>}</p>
                  <p className="truncate text-xs text-muted-foreground">{device}{direction && ` · ${direction}`}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    <time dateTime={reading.accessTime} title={Number.isFinite(Date.parse(reading.accessTime)) ? formatTrDateTime(new Date(reading.accessTime)) : undefined}>{feedTimeTr(reading.accessTime, now) ?? "—"}</time>
                  </p>
                  <p className={cn("text-[11px] font-medium", granted ? "text-success" : denied ? "text-danger" : "text-muted-foreground")}>
                    {granted ? "İzin verildi" : denied ? "Reddedildi" : "Durum bilinmiyor"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DashboardPanel>
  );
}
