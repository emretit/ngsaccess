import { useMemo } from "react";
import { Users, UserCheck, DoorOpen, UserX } from "lucide-react";
import { Visitor, isVisitorInside } from "@/types/visitor";

interface VisitorStatsProps {
  visitors: Visitor[];
}

export function VisitorStats({ visitors }: VisitorStatsProps) {
  const stats = useMemo(
    () => ({
      total: visitors.length,
      active: visitors.filter((v) => v.isActive).length,
      inside: visitors.filter((v) => isVisitorInside(v)).length,
      ended: visitors.filter((v) => !v.isActive).length,
    }),
    [visitors],
  );

  const cards = [
    { label: "Toplam", value: stats.total, Icon: Users, tone: "blue" },
    { label: "Aktif", value: stats.active, Icon: UserCheck, tone: "green" },
    { label: "Şu an binada", value: stats.inside, Icon: DoorOpen, tone: "amber" },
    { label: "Pasif / Süresi doldu", value: stats.ended, Icon: UserX, tone: "red" },
  ] as const;

  const toneClass: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400",
    amber: "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, Icon, tone }) => (
        <div
          key={label}
          className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
