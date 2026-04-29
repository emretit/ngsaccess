
import { DeviceFormButton } from "@/components/devices/DeviceFormButton";

interface DevicesHeaderProps {
  deviceCount: number;
  filteredCount: number;
  onOpenDevicePanel: () => void;
}

export function DevicesHeader({
  deviceCount,
  filteredCount,
  onOpenDevicePanel
}: DevicesHeaderProps) {
  return (
    <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-xs border">
      <div className="flex-1">
        <h1 className="text-2xl font-semibold text-gray-900">Cihazlar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {deviceCount} cihaz bulundu, {filteredCount} tanesi gösteriliyor
        </p>
      </div>
      <div className="shrink-0">
        <DeviceFormButton onOpenDevicePanel={onOpenDevicePanel} />
      </div>
    </div>
  );
}
