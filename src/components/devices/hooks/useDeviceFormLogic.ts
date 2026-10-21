import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthState } from "@/hooks/useAuthState";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { ServerDevice } from "@/types/device";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  makeFormSchema,
  FormValues,
  type DeviceBrand,
} from "./useDeviceFormSchema";
import { buildDeviceFormValues } from "./buildDeviceFormValues";
import { useDeviceFormSubmission } from "./useDeviceFormSubmission";

interface UseDeviceFormLogicProps {
  open?: boolean;
  device?: ServerDevice | null;
  defaultBrand?: DeviceBrand;
  onSuccess: () => void;
  /** Admin akışı: cihazı aktif proje yerine seçilen projeye yazar. */
  projectIdOverride?: Id<"projects"> | null;
  /** Admin modu: yalnız bağlantı kimliği; isim seri/UUID'den türetilir, zorunlu değil. */
  adminMode?: boolean;
}

export function useDeviceFormLogic({
  open = true,
  device,
  defaultBrand,
  onSuccess,
  projectIdOverride,
  adminMode,
}: UseDeviceFormLogicProps) {
  const { user } = useAuthState();
  const { projectId } = useActiveProject();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();

  const currentProjectId = projectIdOverride ?? projectId ?? null;

  const schema = useMemo(
    () => makeFormSchema(!!adminMode, !!device),
    [adminMode, device],
  );

  // Canlı IP/model güncellemeleri kaydedilmemiş düzenlemeyi sıfırlamamalı.
  // Form değerleri yalnız açılışta veya cihaz/marka kimliği değişince yenilenir.
  const deviceId = device?._id;
  const [snapshot, setSnapshot] = useState(() => ({
    deviceId, defaultBrand, open,
    values: buildDeviceFormValues(device, defaultBrand),
  }));
  if (snapshot.deviceId !== deviceId || snapshot.defaultBrand !== defaultBrand || snapshot.open !== open) {
    setSnapshot({ deviceId, defaultBrand, open, values: buildDeviceFormValues(device, defaultBrand) });
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    values: snapshot.values,
  });

  // Watch zone selection for filtering doors
  // react-hook-form internal subscription'ı React compiler analizinden muaftır.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter(
    (door) => String(door.zoneId) === String(selectedZoneId),
  );

  // Handle form submission
  const { onSubmit, isLoading, connectionError } = useDeviceFormSubmission({
    device,
    currentProjectId,
    onSuccess: () => {
      form.reset(form.getValues());
      onSuccess();
    },
    adminMode,
  });

  return {
    form,
    onSubmit,
    isLoading,
    connectionError,
    user,
    currentProjectId,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    filteredDoors,
  };
}
