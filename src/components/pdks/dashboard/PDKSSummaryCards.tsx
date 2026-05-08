import { Users, UserCheck, Clock, Timer, Building, Palmtree, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusFilter } from "./PDKSFilterBar";

interface PreviousData {
  totalEmployees: number;
  presentToday: number;
  lateArrivals: number;
  overtimeHours: number;
  insideBuilding: number;
  leaveToday: number;
  devamOrani: number;
}

interface SummaryData {
  totalEmployees: number;
  presentToday: number;
  lateArrivals: number;
  overtimeHours: number;
  insideBuilding: number;
  leaveToday?: number;
  devamOrani?: number;
  topLateDepartment?: string;
  topLateDepartmentCount?: number;
  previous?: PreviousData;
}

interface PDKSSummaryCardsProps {
  data: SummaryData;
  onCardClick?: (statusFilter: StatusFilter) => void;
}

function TrendBadge({
  current,
  previous,
  invertColor,
}: {
  current: number;
  previous?: number;
  invertColor?: boolean;
}) {
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

export function PDKSSummaryCards({ data, onCardClick }: PDKSSummaryCardsProps) {
  const stats: Array<{
    title: string;
    value: number | string;
    icon: typeof Users;
    color: string;
    sub?: string;
    statusFilter?: StatusFilter;
    trend?: { current: number; previous?: number; invertColor?: boolean };
  }> = [
    {
      title: "Toplam Çalışan",
      value: data.totalEmployees,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Bugün Mevcut",
      value: data.presentToday,
      icon: UserCheck,
      color: "text-emerald-600",
      sub: `%${data.devamOrani ?? 0}`,
      statusFilter: "present",
      trend: { current: data.presentToday, previous: data.previous?.presentToday },
    },
    {
      title: "Geç Kalanlar",
      value: data.lateArrivals,
      icon: Clock,
      color: "text-orange-600",
      sub:
        data.topLateDepartment && data.topLateDepartment !== "-"
          ? `${data.topLateDepartment} (${data.topLateDepartmentCount})`
          : undefined,
      statusFilter: "late",
      trend: {
        current: data.lateArrivals,
        previous: data.previous?.lateArrivals,
        invertColor: true,
      },
    },
    {
      title: "Mesai",
      value: `${data.overtimeHours}h`,
      icon: Timer,
      color: "text-purple-600",
      statusFilter: "overtime",
      trend: { current: data.overtimeHours, previous: data.previous?.overtimeHours },
    },
    {
      title: "İzindeki",
      value: data.leaveToday ?? 0,
      icon: Palmtree,
      color: "text-amber-600",
      statusFilter: "leave",
      trend: { current: data.leaveToday ?? 0, previous: data.previous?.leaveToday },
    },
    {
      title: "İçeride",
      value: data.insideBuilding,
      icon: Building,
      color: "text-rose-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded-lg border bg-card divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden">
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
                  {stat.value}
                </span>
                {stat.trend && (
                  <TrendBadge
                    current={stat.trend.current}
                    previous={stat.trend.previous}
                    invertColor={stat.trend.invertColor}
                  />
                )}
                {stat.sub && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {stat.sub}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
