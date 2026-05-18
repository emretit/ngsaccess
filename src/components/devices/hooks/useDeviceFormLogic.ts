
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthState } from "@/hooks/useAuthState";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { ServerDevice } from "@/types/device";
import { formSchema, FormValues, type DeviceBrand } from "./useDeviceFormSchema";
import { useDeviceDataLoader } from "./useDeviceDataLoader";
import { useDeviceFormSubmission } from "./useDeviceFormSubmission";

interface UseDeviceFormLogicProps {
  device?: ServerDevice | null;
  open: boolean;
  defaultBrand?: DeviceBrand;
  onSuccess: () => void;
}

export function useDeviceFormLogic({ device, open, defaultBrand, onSuccess }: UseDeviceFormLogicProps) {
  const { user } = useAuthState();
  const { projectId } = useActiveProject();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();

  const currentProjectId = projectId ?? null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      brand: defaultBrand ?? "other",
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
      ehome_id: "",
      ehome_key: "",
    },
  });

  // Watch zone selection for filtering doors
  // react-hook-form internal subscription'ı React compiler analizinden muaftır.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter((door) => String(door.zoneId) === String(selectedZoneId));

  // Load device data when dialog opens
  useDeviceDataLoader({ device, open, defaultBrand, form });

  // Handle form submission
  const { onSubmit, isLoading } = useDeviceFormSubmission({
    device,
    currentProjectId,
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
