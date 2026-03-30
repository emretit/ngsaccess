// @ts-nocheck

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthState } from "@/hooks/useAuthState";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { ServerDevice } from "@/types/device";
import { formSchema, FormValues } from "./useDeviceFormSchema";
import { useDeviceDataLoader } from "./useDeviceDataLoader";
import { useDeviceFormSubmission } from "./useDeviceFormSubmission";

interface UseDeviceFormLogicProps {
  device?: ServerDevice | null;
  open: boolean;
  onSuccess: () => void;
}

export function useDeviceFormLogic({ device, open, onSuccess }: UseDeviceFormLogicProps) {
  const { user } = useAuthState();
  const { projectIds } = useProjectAccess();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();

  // Get the first project ID as current project ID
  const currentProjectId = projectIds.length > 0 ? projectIds[0] : null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      device_serial: "",
      device_type: "Kart Okuyucu",
      zone_id: undefined,
      door_id: undefined,
      access_direction: "both",
      status: "active",
      device_username: "",
      device_password: "",
      description: "",
    },
  });

  // Watch zone selection for filtering doors
  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter((door) => String(door.zoneId) === String(selectedZoneId));

  // Load device data when dialog opens
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
    onSubmit,
    isLoading,
    user,
    currentProjectId,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    filteredDoors,
  };
}
