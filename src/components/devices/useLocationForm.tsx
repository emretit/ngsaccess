// @ts-nocheck

import { useState } from "react";
import { Device } from "@/types/device";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function useLocationForm() {
  const [showLocationForm, setShowLocationForm] = useState<{open: boolean; device: Device | null}>({
    open: false, 
    device: null
  });
  
  const { toast } = useToast();
  const updateDevice = useMutation(api.devices.update);

  const openLocationForm = (device: Device) => {
    setShowLocationForm({ open: true, device });
  };

  const closeLocationForm = () => {
    setShowLocationForm({ open: false, device: null });
  };

  const handleAssignLocation = async (zoneId: string, doorId: string) => {
    if (!showLocationForm.device) return;
    try {
      await updateDevice({
        id: showLocationForm.device.id as Id<"devices">,
        zoneId: zoneId as Id<"zones">,
        doorId: doorId as Id<"doors">,
      });
      toast({ title: "Konum atandı", description: "Cihaz konumu başarıyla güncellendi" });
      closeLocationForm();
    } catch {
      toast({ title: "Hata", description: "Konum atanırken bir hata oluştu", variant: "destructive" });
    }
  };

  return {
    showLocationForm,
    openLocationForm,
    closeLocationForm,
    handleAssignLocation
  };
}
