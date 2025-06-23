
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeviceFormButtonProps {
  onOpenDevicePanel: () => void;
}

export function DeviceFormButton({ onOpenDevicePanel }: DeviceFormButtonProps) {
  return (
    <Button 
      onClick={onOpenDevicePanel}
      className="bg-burgundy hover:bg-burgundy/90 text-white font-medium px-6 py-2 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
      size="default"
    >
      <Plus className="h-4 w-4" />
      <span>Yeni Cihaz</span>
    </Button>
  );
}
