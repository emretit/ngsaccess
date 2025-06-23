
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
      // Device ID'leri hem string hem integer formatında hazırla
      const deviceIds = selectedDevices.map(id => parseInt(id));
      
      console.log('Device IDs to delete:', { original: selectedDevices, parsed: deviceIds });

      // Önce tüm seçili cihazlara ait card_readings kayıtlarını sil
      const { error: cardReadingsError } = await supabase
        .from('card_readings')
        .delete()
        .in('device_id', deviceIds);

      if (cardReadingsError) {
        console.error('Error deleting related card readings:', cardReadingsError);
        // Card readings silme hatası kritik değil, devam et
      }

      // Şimdi cihazları sil - String ID'leri kullan
      const { error: devicesError, data: deletedData } = await supabase
        .from('devices')
        .delete()
        .in('id', selectedDevices) // String array kullan
        .select(); // Silinen kayıtları görmek için select ekle

      console.log('Bulk delete operation result:', { error: devicesError, data: deletedData });

      if (devicesError) {
        console.error('Bulk delete devices error:', devicesError);
        throw new Error(`Cihazlar silinirken hata oluştu: ${devicesError.message}`);
      }

      // Eğer hiçbir kayıt silinmediyse
      if (!deletedData || deletedData.length === 0) {
        throw new Error('Seçilen cihazlar bulunamadı veya silinemedi');
      }

      console.log('Bulk delete successful:', deletedData);

      toast({
        title: "Başarılı",
        description: `${deletedData.length} cihaz başarıyla silindi`,
      });
      
      // Refresh devices data
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      
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
