
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeviceFormButtonProps {
  onOpenDevicePanel: () => void;
}

export function DeviceFormButton({ onOpenDevicePanel }: DeviceFormButtonProps) {
  return (
    <Button onClick={onOpenDevicePanel}>
      <Plus className="mr-2 h-4 w-4" />
      Yeni Cihaz
    </Button>
  );
}
