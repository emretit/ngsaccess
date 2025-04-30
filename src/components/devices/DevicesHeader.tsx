
import { Button } from "@/components/ui/button";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { Edit } from "lucide-react";

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
      <div className="space-x-2">
        <DeviceForm onAddDevice={onAddDevice} isLoading={isAddingDevice} />
        <Button variant="outline" onClick={onOpenDevicePanel}>
          <Edit className="mr-2 h-4 w-4" />
          Yeni Cihaz Oluştur
        </Button>
      </div>
    </div>
  );
}
