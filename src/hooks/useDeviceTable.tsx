
import { useState } from 'react';
import { Device } from '@/types/device';
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function useDeviceTable(devices: Device[]) {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(devices.map(device => device.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (checked: boolean, deviceId: string) => {
    if (checked) {
      setSelectedDevices([...selectedDevices, deviceId]);
    } else {
      setSelectedDevices(selectedDevices.filter(id => id !== deviceId));
    }
  };

  const handleBulkDelete = async () => {
    try {
      // Process each device deletion sequentially
      for (const deviceId of selectedDevices) {
        await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      }

      toast({
        title: "Başarılı",
        description: `${selectedDevices.length} cihaz başarıyla silindi`,
      });
      
      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      setSelectedDevices([]);
      setShowDeleteDialog(false);
    } catch (error) {
      toast({
        title: "Hata",
        description: "Cihazlar silinirken bir hata oluştu",
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
