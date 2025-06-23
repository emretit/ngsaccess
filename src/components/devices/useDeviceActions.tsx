
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDeviceActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteDevice = async (deviceId: string) => {
    console.log('🔄 Starting device deletion process for ID:', deviceId);
    
    try {
      // Device ID'yi kontrol et ve çevir
      const numericDeviceId = parseInt(deviceId);
      
      if (isNaN(numericDeviceId)) {
        throw new Error('Geçersiz cihaz ID\'si');
      }

      console.log('🔍 Parsed device ID:', numericDeviceId);

      // Önce cihazın mevcut olup olmadığını ve kullanıcının erişim hakkı olup olmadığını kontrol et
      const { data: existingDevice, error: checkError } = await supabase
        .from('devices')
        .select('id, name, project_id')
        .eq('id', numericDeviceId)
        .single();

      console.log('📋 Device exists check:', { device: existingDevice, error: checkError });

      if (checkError || !existingDevice) {
        throw new Error('Cihaz bulunamadı veya erişim yetkiniz yok');
      }

      // Önce card_readings tablosundaki ilişkili kayıtları sil
      console.log('🗑️ Deleting related card readings...');
      const { error: cardReadingsError, count: deletedReadingsCount } = await supabase
        .from('card_readings')
        .delete({ count: 'exact' })
        .eq('device_id', numericDeviceId);

      console.log('📊 Card readings deletion result:', { 
        error: cardReadingsError, 
        deletedCount: deletedReadingsCount 
      });

      if (cardReadingsError) {
        console.error('⚠️ Error deleting card readings:', cardReadingsError);
        // Card readings silme hatası kritik değil, devam et
      }

      // Şimdi cihazı sil - RLS politikaları otomatik olarak proje kontrolü yapacak
      console.log('🗑️ Deleting device...');
      const { error: deviceError, data: deletedData, count: deletedCount } = await supabase
        .from('devices')
        .delete({ count: 'exact' })
        .eq('id', numericDeviceId)
        .select();

      console.log('📊 Device deletion result:', { 
        error: deviceError, 
        data: deletedData, 
        deletedCount: deletedCount 
      });

      if (deviceError) {
        console.error('❌ Delete device error:', deviceError);
        throw new Error(`Cihaz silinirken hata oluştu: ${deviceError.message}`);
      }

      // Eğer hiçbir kayıt silinmediyse
      if (!deletedData || deletedData.length === 0 || deletedCount === 0) {
        console.error('❌ No device was deleted');
        throw new Error('Cihaz silinemedi - erişim yetkiniz olmayabilir');
      }

      console.log('✅ Device deleted successfully:', deletedData);

      toast({
        title: "Başarılı",
        description: "Cihaz başarıyla silindi",
      });
      
      // Refresh devices data
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      
    } catch (error: any) {
      console.error('💥 Delete device error:', error);
      toast({
        title: "Hata",
        description: error.message || "Cihaz silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  return {
    handleDeleteDevice
  };
}
