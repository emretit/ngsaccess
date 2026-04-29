import { Smartphone, CircleCheck, WifiOff, AlertCircle } from "lucide-react";
import { Device } from "@/types/device";
import { useMemo } from "react";

interface DeviceStatsProps {
  devices: Device[];
}

export function DeviceStats({ devices }: DeviceStatsProps) {
  const stats = useMemo(() => ({
    total: devices.length,
    online: devices.filter((device) => device.status === "online").length,
    offline: devices.filter((device) => device.status === "offline").length,
    expired: devices.filter((device) => device.status === "expired").length,
  }), [devices]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
          <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Toplam</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{stats.total}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
          <CircleCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Aktif</p>
          <p className="text-xl font-bold tabular-nums leading-tight text-green-600 dark:text-green-400">
            {stats.online}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
          <WifiOff className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Pasif</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{stats.offline}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Süresi Dolmuş</p>
          <p className="text-xl font-bold tabular-nums leading-tight text-red-600 dark:text-red-400">
            {stats.expired}
          </p>
        </div>
      </div>
    </div>
  );
}
