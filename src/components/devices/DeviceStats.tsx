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
    online:  devices.filter((d) => d.connectionStatus === "online").length,
    offline: devices.filter((d) => d.connectionStatus === "offline").length,
    never: devices.filter((d) => d.connectionStatus === "never").length,
  }), [devices]);

  const cards: { label: string; value: number; Icon: typeof Smartphone; tone: StatTone }[] = [
    { label: "Toplam",          value: stats.total,   Icon: Smartphone,  tone: "info" },
    { label: "Çevrimiçi",           value: stats.online,  Icon: CircleCheck, tone: "success" },
    { label: "Çevrimdışı",           value: stats.offline, Icon: WifiOff,     tone: "default" },
    { label: "Henüz bağlanmadı",   value: stats.never, Icon: AlertCircle, tone: "default" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, Icon, tone }) => (
        <StatCard key={label} label={label} value={value} Icon={Icon} tone={tone} />
      ))}
    </div>
  );
}
