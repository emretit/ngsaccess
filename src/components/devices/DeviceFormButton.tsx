
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeviceFormButtonProps {
  onOpenDevicePanel: () => void;
  label?: string;
}

export function DeviceFormButton({ onOpenDevicePanel, label = "Yeni Cihaz" }: DeviceFormButtonProps) {
  return (
    <Button onClick={onOpenDevicePanel} size="sm" className="h-8 gap-1.5 text-xs">
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
