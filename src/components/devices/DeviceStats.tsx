import { Smartphone, CircleCheck, WifiOff, AlertCircle } from "lucide-react";
import { Device } from "@/types/device";
import { useMemo } from "react";
import { StatCard, type StatTone } from "@/components/shared/StatCard";

interface DeviceStatsProps {
  devices: Device[];
}

export function DeviceStats({ devices }: DeviceStatsProps) {
  const stats = useMemo(() => ({
    total:   devices.length,
    online:  devices.filter((d) => d.status === "online").length,
    offline: devices.filter((d) => d.status === "offline").length,
    expired: devices.filter((d) => d.status === "expired").length,
  }), [devices]);

  const cards: { label: string; value: number; Icon: typeof Smartphone; tone: StatTone }[] = [
    { label: "Toplam",          value: stats.total,   Icon: Smartphone,  tone: "info" },
    { label: "Aktif",           value: stats.online,  Icon: CircleCheck, tone: "success" },
    { label: "Pasif",           value: stats.offline, Icon: WifiOff,     tone: "default" },
    { label: "Süresi Dolmuş",   value: stats.expired, Icon: AlertCircle, tone: "danger" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, Icon, tone }) => (
        <StatCard key={label} label={label} value={value} Icon={Icon} tone={tone} />
      ))}
    </div>
  );
}
