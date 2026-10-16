import type { PdksSummary } from "@/lib/pdksSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Clock, Timer, Building, Palmtree, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import type { StatusFilter } from "./PDKSFilterBar";

interface PreviousSeries {
  presentToday: number[];
  lateArrivals: number[];
  overtimeHours: number[];
  leaveToday: number[];
}

interface PDKSSummaryCardsProps {
  data: PdksSummary;
  loading?: boolean;
  liveData?: { insideBuilding: number; previousSeries?: PreviousSeries };
  liveLoading?: boolean;
  isPeriod?: boolean;
  onCardClick?: (statusFilter: StatusFilter) => void;
}

function Sparkline({
  series,
  current,
  invertColor,
}: {
  series?: number[];
  current: number;
  invertColor?: boolean;
}) {
  if (!series || series.length === 0) return null;
  const data = [...series, current].map((v, i) => ({ x: i, y: v }));
  const start = series[0] ?? 0;
  const isUp = current > start;
  const isPositive = invertColor ? !isUp : isUp;
  const stroke = current === start
    ? "var(--muted-foreground)"
    : isPositive
      ? "#059669"
      : "#e11d48";
  return (
    <div className="h-6 w-14 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendBadge({
  current,
  series,
  invertColor,
}: {
  current: number;
  series?: number[];
  invertColor?: boolean;
}) {
  const previous = series?.[series.length - 1];
  if (previous === undefined) return null;
  if (current === previous) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
      </span>
    );
  }
  const diff = current - previous;
  const pct = previous === 0 ? 100 : Math.round((diff / previous) * 100);
  const isUp = diff > 0;
  const isPositive = invertColor ? !isUp : isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
        isPositive ? "text-emerald-600" : "text-rose-600"
      )}
    >
      {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(pct)}%
    </span>
  );
}

export function PDKSSummaryCards({ data, loading, liveData, liveLoading, isPeriod, onCardClick }: PDKSSummaryCardsProps) {
  const stats: Array<{
    title: string;
    value: number | string;
    icon: typeof Users;
    color: string;
    sub?: string;
    statusFilter?: StatusFilter;
    current?: number;
    invertColor?: boolean;
    series?: number[];
  }> = [
    {
      title: "Toplam Çalışan",
      value: data.totalEmployees,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: isPeriod ? "Mevcut (kişi-gün)" : "Mevcut",
      value: data.present,
      icon: UserCheck,
      color: "text-emerald-600",
      sub: `%${data.attendanceRate ?? 0}`,
      statusFilter: "present",
      current: data.present,
      series: liveData?.previousSeries?.presentToday,
    },
    {
      title: isPeriod ? "Geç (kişi-gün)" : "Geç Kalanlar",
      value: data.late,
      icon: Clock,
      color: "text-orange-600",
      statusFilter: "late",
      current: data.late,
      invertColor: true,
      series: liveData?.previousSeries?.lateArrivals,
    },
    {
      title: "Mesai",
      value: `${data.overtimeHours}h`,
      icon: Timer,
      color: "text-purple-600",
      statusFilter: "overtime",
      current: data.overtimeHours,
      series: liveData?.previousSeries?.overtimeHours,
    },
    {
      title: isPeriod ? "İzinli (kişi-gün)" : "İzindeki",
      value: data.leave ?? 0,
      icon: Palmtree,
      color: "text-amber-600",
      statusFilter: "leave",
      current: data.leave ?? 0,
      series: liveData?.previousSeries?.leaveToday,
    },
    {
      title: isPeriod ? "Devamsız (kişi-gün)" : "Devamsız",
      value: data.absent,
      icon: Users,
      color: "text-rose-600",
      statusFilter: "absent",
    },
    ...(liveData ? [{
      title: "İçeride", value: liveData.insideBuilding,
      icon: Building, color: "text-rose-600",
    }] : []),
  ];

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 rounded-lg border bg-card divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden", liveData ? "lg:grid-cols-7" : "lg:grid-cols-6")}>
      {stats.map((stat, i) => {
        const clickable = !!stat.statusFilter && !!onCardClick;
        const rowDivider =
          i < stats.length - 1
            ? i % 2 === 0
              ? "border-b sm:border-b-0"
              : ""
            : "";
        return (
          <button
            key={stat.title}
            type="button"
            disabled={!clickable}
            onClick={
              clickable
                ? () => onCardClick(stat.statusFilter as StatusFilter)
                : undefined
            }
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
              clickable
                ? "hover:bg-muted/50 cursor-pointer"
                : "cursor-default",
              rowDivider
            )}
          >
            <div className={cn("shrink-0", stat.color)}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-muted-foreground truncate">
                {stat.title}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-semibold tabular-nums text-foreground leading-none">
                  {loading || (stat.title === "İçeride" && liveLoading) ? <Skeleton className="h-5 w-12" /> : stat.value}
                </span>
                {stat.current !== undefined && (
                  <TrendBadge
                    current={stat.current}
                    series={stat.series}
                    invertColor={stat.invertColor}
                  />
                )}
                {stat.sub && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {stat.sub}
                  </span>
                )}
              </div>
            </div>
            {stat.series && stat.current !== undefined && (
              <Sparkline
                series={stat.series}
                current={stat.current}
                invertColor={stat.invertColor}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
