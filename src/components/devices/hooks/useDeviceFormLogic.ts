
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ServerDevice } from "@/types/device";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { formSchema, FormValues } from "./useDeviceFormSchema";
import { useDeviceDataLoader } from "./useDeviceDataLoader";
import { useDeviceFormSubmission } from "./useDeviceFormSubmission";

interface UseDeviceFormLogicProps {
  device?: ServerDevice | null;
  open: boolean;
  onSuccess: () => void;
}

export function useDeviceFormLogic({ device, open, onSuccess }: UseDeviceFormLogicProps) {
  const { projectIds } = useProjectAccess();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();
  
  const currentProjectId = projectIds[0] || null;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      serial_number: "",
      device_model_enum: "Other",
      access_direction: "both",
      status: "active",
      description: "",
    },
  });

  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter(door => door.zone_id === selectedZoneId);

  // Load device data when form opens
  useDeviceDataLoader({ device, open, form });

  // Handle form submission
  const { onSubmit, isLoading } = useDeviceFormSubmission({
    device,
    currentProjectId,
    projectIds,
    onSuccess,
  });

  return {
    form,
    isLoading,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    filteredDoors,
    onSubmit,
  };
}
