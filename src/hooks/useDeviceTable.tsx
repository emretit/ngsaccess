
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
    console.log('Attempting to bulk delete devices:', selectedDevices);
    
    try {
      // Önce tüm seçili cihazlara ait card_readings kayıtlarını sil
      const deviceIds = selectedDevices.map(id => parseInt(id));
      
      const { error: cardReadingsError } = await supabase
        .from('card_readings')
        .delete()
        .in('device_id', deviceIds);

      if (cardReadingsError) {
        console.error('Error deleting related card readings:', cardReadingsError);
        // Card readings silme hatası kritik değil, devam et
      }

      // Şimdi cihazları sil
      const { error: devicesError } = await supabase
        .from('devices')
        .delete()
        .in('id', deviceIds);

      if (devicesError) {
        console.error('Bulk delete devices error:', devicesError);
        throw new Error(`Cihazlar silinirken hata oluştu: ${devicesError.message}`);
      }

      console.log('Bulk delete successful');

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
