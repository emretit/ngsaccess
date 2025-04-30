
import { useState } from "react";
import { Device } from "@/types/device";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function useLocationForm() {
  const [showLocationForm, setShowLocationForm] = useState<{open: boolean; device: Device | null}>({
    open: false, 
    device: null
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const openLocationForm = (device: Device) => {
    setShowLocationForm({open: true, device});
  };

  const closeLocationForm = () => {
    setShowLocationForm({open: false, device: null});
  };

  const handleAssignLocation = async (zoneId: number, doorId: number) => {
    if (!showLocationForm.device) return;
    
    try {
      // Update device location in database
      const { error } = await fetch(`/api/devices/${showLocationForm.device.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: zoneId,
          door_id: doorId
        })
      }).then(res => res.json());
      
      if (error) throw new Error(error);

      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      toast({
        title: "Konum atandı",
        description: "Cihaz konumu başarıyla güncellendi",
      });
      
      closeLocationForm();
    } catch (error) {
      toast({
        title: "Hata",
        description: "Konum atanırken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  return {
    showLocationForm,
    openLocationForm,
    closeLocationForm,
    handleAssignLocation
  };
}
