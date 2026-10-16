
import { useState } from "react";
import { Device } from "@/types/device";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function useLocationForm() {
  const [showLocationForm, setShowLocationForm] = useState<{open: boolean; device: Device | null}>({
    open: false, 
    device: null
  });
  
  const updateDevice = useMutation(api.devices.update);

  const openLocationForm = (device: Device) => {
    setShowLocationForm({ open: true, device });
  };

  const closeLocationForm = () => {
    setShowLocationForm({ open: false, device: null });
  };

  const handleAssignLocation = async (zoneId: string, doorId: string) => {
    if (!showLocationForm.device) throw new Error("Konum atanacak cihaz bulunamadı");
    await updateDevice({
      deviceId: showLocationForm.device._id,
      zoneId: zoneId as Id<"zones">,
      doorId: showLocationForm.device.brand === "ide_smart" || showLocationForm.device.brand === "hikvision" ? undefined : doorId as Id<"doors">,
    });
  };

  return {
    showLocationForm,
    openLocationForm,
    closeLocationForm,
    handleAssignLocation
  };
}
