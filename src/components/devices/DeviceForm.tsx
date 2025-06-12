
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DeviceFormProps {
  onOpenDevicePanel: () => void;
}

export function DeviceForm({ onOpenDevicePanel }: DeviceFormProps) {
  return (
    <Button 
      onClick={onOpenDevicePanel}
      className="bg-primary hover:bg-primary/90"
    >
      <Plus className="mr-2 h-4 w-4" /> Yeni Cihaz Ekle
    </Button>
  );
}
