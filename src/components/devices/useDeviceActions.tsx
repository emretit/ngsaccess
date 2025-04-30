
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function useDeviceActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      toast({
        title: "Cihaz silindi",
        description: "Cihaz başarıyla silindi",
      });
      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Cihaz silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  return {
    handleDeleteDevice
  };
}
