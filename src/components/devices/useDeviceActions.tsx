
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDeviceActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteDevice = async (deviceId: string) => {
    console.log('Attempting to delete device with ID:', deviceId);
    
    try {
      // Device ID'yi number'a çevir
      const numericDeviceId = parseInt(deviceId);
      
      if (isNaN(numericDeviceId)) {
        throw new Error('Geçersiz cihaz ID\'si');
      }

      // Önce card_readings tablosundaki ilişkili kayıtları sil
      const { error: cardReadingsError } = await supabase
        .from('card_readings')
        .delete()
        .eq('device_id', numericDeviceId);

      if (cardReadingsError) {
        console.error('Error deleting card readings:', cardReadingsError);
        // Card readings silme hatası kritik değil, devam et
      }

      // Şimdi cihazı sil - numeric ID kullan
      const { error: deviceError, data: deletedData } = await supabase
        .from('devices')
        .delete()
        .eq('id', numericDeviceId)
        .select(); // Silinen kayıtları görmek için select ekle

      console.log('Delete operation result:', { error: deviceError, data: deletedData });

      if (deviceError) {
        console.error('Delete device error:', deviceError);
        throw new Error(`Cihaz silinirken hata oluştu: ${deviceError.message}`);
      }

      // Eğer hiçbir kayıt silinmediyse
      if (!deletedData || deletedData.length === 0) {
        throw new Error('Cihaz bulunamadı veya silinemedi');
      }

      console.log('Device deleted successfully:', deletedData);

      toast({
        title: "Başarılı",
        description: "Cihaz başarıyla silindi",
      });
      
      // Refresh devices data
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      
    } catch (error: any) {
      console.error('Delete device error:', error);
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
