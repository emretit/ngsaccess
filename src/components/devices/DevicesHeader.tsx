
import { DeviceForm } from "@/components/devices/DeviceForm";

interface DevicesHeaderProps {
  deviceCount: number;
  filteredCount: number;
  onAddDevice: (serialNumber: string) => void;
  isAddingDevice: boolean;
  onOpenDevicePanel: () => void;
}

export function DevicesHeader({
  deviceCount,
  filteredCount,
  onAddDevice,
  isAddingDevice,
  onOpenDevicePanel
}: DevicesHeaderProps) {
  return (
    <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border-0">
      <div>
        <h1 className="text-2xl font-semibold">Cihazlar</h1>
        <p className="text-sm text-muted-foreground">
          {deviceCount} cihaz bulundu, {filteredCount} tanesi gösteriliyor
        </p>
      </div>
      <div>
        <DeviceForm onAddDevice={onAddDevice} isLoading={isAddingDevice} onOpenDevicePanel={onOpenDevicePanel} />
      </div>
    </div>
  );
}
