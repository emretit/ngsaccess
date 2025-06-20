
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDeviceActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', parseInt(deviceId));

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast({
        title: "Cihaz silindi",
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
