import { useMemo } from "react";
import { Users, UserCheck, DoorOpen, UserX } from "lucide-react";
import { Visitor, isVisitorInside } from "@/types/visitor";
import { StatCard, type StatTone } from "@/components/shared/StatCard";

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

  const cards: { label: string; value: number; Icon: typeof Users; tone: StatTone }[] = [
    { label: "Toplam",               value: stats.total,  Icon: Users,     tone: "info" },
    { label: "Aktif",                value: stats.active, Icon: UserCheck,  tone: "success" },
    { label: "Şu an binada",         value: stats.inside, Icon: DoorOpen,   tone: "warning" },
    { label: "Pasif / Süresi doldu", value: stats.ended,  Icon: UserX,      tone: "danger" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, Icon, tone }) => (
        <StatCard key={label} label={label} value={value} Icon={Icon} tone={tone} />
      ))}
    </div>
  );
}
