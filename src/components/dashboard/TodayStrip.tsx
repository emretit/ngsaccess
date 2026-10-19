import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import NumberFlow from "@number-flow/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardActivity, useDashboardStats } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

function Metric({ label, value, suffix, tone, loading, children }: {
  label: string;
  value: number;
  suffix?: ReactNode;
  tone?: "warning";
  loading: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 px-4 py-4 min-[761px]:px-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        {loading ? (
          <><span className="sr-only">Yükleniyor</span><Skeleton className="my-2 h-6 w-16" /></>
        ) : (
          <span className={cn("text-[30px] font-[550] leading-10 tracking-[-1px] tabular-nums", tone === "warning" && value > 0 && "text-warning")}>
            <NumberFlow value={value} locales="tr-TR" />
            {suffix && <span className="ml-1 text-base font-normal tracking-normal text-muted-foreground">{suffix}</span>}
          </span>
        )}
      </dd>
      {children && <dd className="mt-1 text-[11px] text-muted-foreground">{children}</dd>}
    </div>
  );
}

/** Bugünün durumu: gelen / içeride / geç kalan / kart okuması. */
export default function TodayStrip() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { summary, loading: activityLoading } = useDashboardActivity();
  const loading = statsLoading || activityLoading;
  const employees = stats?.employees ?? 0;
  const present = summary?.presentToday ?? 0;
  const rate = employees > 0 ? Math.min(100, Math.round((present / employees) * 100)) : 0;
  return (
    <>
      <dl aria-label="Bugünün özeti" aria-busy={loading} className="grid grid-cols-2 overflow-hidden rounded-lg border bg-surface min-[1000px]:grid-cols-4 max-[999px]:[&>div:nth-child(-n+2)]:border-b max-[999px]:[&>div:nth-child(odd)]:border-r min-[1000px]:[&>div:not(:last-child)]:border-r">
        <Metric label="Bugün gelen" value={present} suffix={`/ ${employees.toLocaleString("tr-TR")}`} loading={loading}>
          <span className="flex items-center gap-2">
            <span
              role="progressbar"
              aria-label="Katılım oranı"
              aria-valuenow={rate}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 flex-1 overflow-hidden rounded-full bg-subtle"
            >
              <span className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${rate}%` }} />
            </span>
            <span className="tabular-nums">%{rate}</span>
          </span>
        </Metric>
        <Metric label="Şu an içeride" value={summary?.insideBuilding ?? 0} loading={loading}>
          Son okuması giriş olanlar
        </Metric>
        <Metric label="Geç kalan" value={summary?.lateArrivals ?? 0} tone="warning" loading={loading}>
          {summary?.workHours ? `Mesai ${summary.workHours}` : "Mesai saati okumayla görünür"}
        </Metric>
        <Metric label="Kart okuması" value={stats?.cardReadings ?? 0} loading={loading}>
          İzin verilen + reddedilen
        </Metric>
      </dl>
      {!loading && stats?.employees === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-surface px-4 py-3 min-[761px]:px-5">
          <div className="mr-auto">
            <p className="font-medium">Henüz personel eklenmemiş</p>
            <p className="text-xs text-muted-foreground">Kişiler sayfasından proje personelini ekleyin.</p>
          </div>
          <Button asChild variant="outline"><Link to="/employees">Kişileri aç</Link></Button>
        </div>
      )}
    </>
  );
}
