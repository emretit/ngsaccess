// @ts-nocheck
import { useState } from "react";
import { Device } from "@/types/device";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useDeviceTable(devices: Device[]) {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const removeDevice = useMutation(api.devices.remove);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(devices.map((d) => d.id || (d as { _id?: string })._id || ""));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (checked: boolean, deviceId: string) => {
    if (checked) {
      setSelectedDevices([...selectedDevices, deviceId]);
    } else {
      setSelectedDevices(selectedDevices.filter((id) => id !== deviceId));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedDevices.map((id) => removeDevice({ deviceId: id as Id<"devices"> })));
      toast({ title: "Başarılı", description: `${selectedDevices.length} cihaz başarıyla silindi` });
      setSelectedDevices([]);
      setShowDeleteDialog(false);
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Cihazlar silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  return {
    selectedDevices,
    showDeleteDialog,
    setShowDeleteDialog,
    handleSelectAll,
    handleSelectDevice,
    handleBulkDelete,
  };
}
