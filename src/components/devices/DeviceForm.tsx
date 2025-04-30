
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DeviceFormProps {
  onAddDevice: (serialNumber: string) => void;
  isLoading: boolean;
  onOpenDevicePanel: () => void;
}

export function DeviceForm({ onAddDevice, isLoading, onOpenDevicePanel }: DeviceFormProps) {
  return (
    <Button 
      onClick={onOpenDevicePanel}
      className="bg-primary hover:bg-primary/90"
    >
      <Plus className="mr-2 h-4 w-4" /> Yeni Cihaz Ekle
    </Button>
  );
}
