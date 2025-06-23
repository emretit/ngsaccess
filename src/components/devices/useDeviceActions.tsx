
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDeviceActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteDevice = async (deviceId: string) => {
    console.log('Attempting to delete device with ID:', deviceId);
    
    try {
      // Önce card_readings tablosundaki ilişkili kayıtları sil
      const { error: cardReadingsError } = await supabase
        .from('card_readings')
        .delete()
        .eq('device_id', parseInt(deviceId));

      if (cardReadingsError) {
        console.error('Error deleting card readings:', cardReadingsError);
        // Card readings silme hatası kritik değil, devam et
      }

      // Şimdi cihazı sil
      const { error: deviceError } = await supabase
        .from('devices')
        .delete()
        .eq('id', parseInt(deviceId));

      if (deviceError) {
        console.error('Delete device error:', deviceError);
        throw new Error(`Cihaz silinirken hata oluştu: ${deviceError.message}`);
      }

      console.log('Device deleted successfully');

      toast({
        title: "Başarılı",
        description: "Cihaz başarıyla silindi",
      });
      
      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
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
