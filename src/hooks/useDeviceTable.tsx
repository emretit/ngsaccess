
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
    console.log('🔄 Starting bulk delete for devices:', selectedDevices);
    
    try {
      // Device ID'leri number array'ine çevir
      const deviceIds = selectedDevices.map(id => {
        const numericId = parseInt(id);
        if (isNaN(numericId)) {
          throw new Error(`Geçersiz cihaz ID'si: ${id}`);
        }
        return numericId;
      });
      
      console.log('🔍 Parsed device IDs:', { original: selectedDevices, parsed: deviceIds });

      // Önce seçili cihazların mevcut olup olmadığını kontrol et
      const { data: existingDevices, error: checkError } = await supabase
        .from('devices')
        .select('id, name, project_id')
        .in('id', deviceIds);

      console.log('📋 Existing devices check:', { devices: existingDevices, error: checkError });

      if (checkError) {
        throw new Error(`Cihazlar kontrol edilirken hata: ${checkError.message}`);
      }

      if (!existingDevices || existingDevices.length === 0) {
        throw new Error('Seçilen cihazlar bulunamadı veya erişim yetkiniz yok');
      }

      console.log(`📊 Found ${existingDevices.length} out of ${deviceIds.length} devices`);

      // Önce tüm seçili cihazlara ait card_readings kayıtlarını sil
      console.log('🗑️ Deleting related card readings...');
      const { error: cardReadingsError, count: deletedReadingsCount } = await supabase
        .from('card_readings')
        .delete({ count: 'exact' })
        .in('device_id', deviceIds);

      console.log('📊 Card readings deletion result:', { 
        error: cardReadingsError, 
        deletedCount: deletedReadingsCount 
      });

      if (cardReadingsError) {
        console.error('⚠️ Error deleting related card readings:', cardReadingsError);
        // Card readings silme hatası kritik değil, devam et
      }

      // Şimdi cihazları sil - RLS politikaları otomatik olarak proje kontrolü yapacak
      console.log('🗑️ Deleting devices...');
      const { error: devicesError, data: deletedData, count: deletedCount } = await supabase
        .from('devices')
        .delete({ count: 'exact' })
        .in('id', deviceIds)
        .select();

      console.log('📊 Bulk delete result:', { 
        error: devicesError, 
        data: deletedData, 
        deletedCount: deletedCount 
      });

      if (devicesError) {
        console.error('❌ Bulk delete devices error:', devicesError);
        throw new Error(`Cihazlar silinirken hata oluştu: ${devicesError.message}`);
      }

      // Eğer hiçbir kayıt silinmediyse
      if (!deletedData || deletedData.length === 0 || deletedCount === 0) {
        console.error('❌ No devices were deleted');
        throw new Error('Seçilen cihazlar silinemedi - erişim yetkiniz olmayabilir');
      }

      console.log('✅ Bulk delete successful:', { deletedData, deletedCount });

      toast({
        title: "Başarılı",
        description: `${deletedCount} cihaz başarıyla silindi`,
      });
      
      // Refresh devices data
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      setSelectedDevices([]);
      setShowDeleteDialog(false);
      
    } catch (error: any) {
      console.error('💥 Bulk delete error:', error);
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
