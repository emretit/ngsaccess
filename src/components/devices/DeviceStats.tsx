
import { Smartphone, WifiOff, CircleCheck, AlertCircle } from "lucide-react";
import { Device } from "@/types/device";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card flex items-center justify-between p-6">
        <Smartphone className="h-8 w-8 text-primary opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Toplam Cihaz</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
      </div>
      
      <div className="glass-card flex items-center justify-between p-6">
        <CircleCheck className="h-8 w-8 text-green-500 opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Aktif Cihaz</p>
          <p className="text-2xl font-bold">{stats.online}</p>
        </div>
      </div>
      
      <div className="glass-card flex items-center justify-between p-6">
        <WifiOff className="h-8 w-8 text-gray-500 opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Pasif Cihaz</p>
          <p className="text-2xl font-bold">{stats.offline}</p>
        </div>
      </div>
      
      <div className="glass-card flex items-center justify-between p-6">
        <AlertCircle className="h-8 w-8 text-red-500 opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Süresi Dolmuş</p>
          <p className="text-2xl font-bold">{stats.expired}</p>
        </div>
      </div>
    </div>
  );
}
