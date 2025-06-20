
import { useState } from 'react';
import { Device } from '@/types/device';
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      // Process each device deletion
      const deletePromises = selectedDevices.map(deviceId => 
        supabase.from('devices').delete().eq('id', parseInt(deviceId))
      );

      const results = await Promise.all(deletePromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Bulk delete errors:', errors);
        throw new Error(`${errors.length} cihaz silinemedi`);
      }

      toast({
        title: "Başarılı",
        description: `${selectedDevices.length} cihaz başarıyla silindi`,
      });
      
      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      setSelectedDevices([]);
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Hata",
        description: error.message || "Cihazlar silinirken bir hata oluştu",
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
