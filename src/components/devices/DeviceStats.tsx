
import { Smartphone, WifiOff, CircleCheck, AlertCircle } from "lucide-react";
import { Device } from "@/types/device";
import { useMemo } from "react";
import StatusCard from "@/components/StatusCard";

interface DeviceStatsProps {
  devices: Device[];
}

export function DeviceStats({ devices }: DeviceStatsProps) {
  const stats = useMemo(() => ({
    total: devices.length,
    online: devices.filter(device => device.status === 'online').length,
    offline: devices.filter(device => device.status === 'offline').length,
    expired: devices.filter(device => device.status === 'expired').length
  }), [devices]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatusCard
        title="Toplam Cihaz"
        value={stats.total}
        icon={<Smartphone className="h-5 w-5 text-primary opacity-75" />}
        className="glass-card"
      />
      
      <StatusCard
        title="Aktif Cihaz"
        value={stats.online}
        icon={<CircleCheck className="h-5 w-5 text-green-500 opacity-75" />}
        className="glass-card"
      />
      
      <StatusCard
        title="Pasif Cihaz"
        value={stats.offline}
        icon={<WifiOff className="h-5 w-5 text-gray-500 opacity-75" />}
        className="glass-card"
      />
      
      <StatusCard
        title="Süresi Dolmuş"
        value={stats.expired}
        icon={<AlertCircle className="h-5 w-5 text-red-500 opacity-75" />}
        className="glass-card"
      />
    </div>
  );
}
