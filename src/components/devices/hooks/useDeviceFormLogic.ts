
import { useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthState } from "@/hooks/useAuthState";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { ServerDevice } from "@/types/device";
import type { Id } from "../../../../convex/_generated/dataModel";
import { makeFormSchema, FormValues, type DeviceBrand } from "./useDeviceFormSchema";
import { buildDeviceFormValues } from "./buildDeviceFormValues";
import { useDeviceFormSubmission } from "./useDeviceFormSubmission";

interface UseDeviceFormLogicProps {
  device?: ServerDevice | null;
  defaultBrand?: DeviceBrand;
  onSuccess: () => void;
  /** Admin akışı: cihazı aktif proje yerine seçilen projeye yazar. */
  projectIdOverride?: Id<"projects"> | null;
  /** Admin modu: yalnız bağlantı kimliği; isim seri/UUID'den türetilir, zorunlu değil. */
  adminMode?: boolean;
}

export function useDeviceFormLogic({ device, defaultBrand, onSuccess, projectIdOverride, adminMode }: UseDeviceFormLogicProps) {
  const { user } = useAuthState();
  const { projectId } = useActiveProject();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();

  const currentProjectId = projectIdOverride ?? projectId ?? null;

  const schema = useMemo(() => makeFormSchema(!!adminMode, !!device), [adminMode, device]);

  // "Yeni Cihaz" ve "Düzenle" TEK form; tek fark verinin dolu gelmesidir. react-hook-form'un
  // `values` API'si device değişince formu deterministik senkronlar — eski reset-in-useEffect
  // yaklaşımındaki mount/brand yarışı (Select'lerin boş gelmesi) burada hiç oluşmaz. device
  // referansı handleEditDevice anında sabitlenir (devicePanel state), bu yüzden useMemo edit
  // boyunca stabildir ve kullanıcının girdiği değerleri ezmez.
  const values = useMemo(
    () => buildDeviceFormValues(device, defaultBrand),
    [device, defaultBrand],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    values,
  });

  // Watch zone selection for filtering doors
  // react-hook-form internal subscription'ı React compiler analizinden muaftır.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter((door) => String(door.zoneId) === String(selectedZoneId));

  // Handle form submission
  const { onSubmit, isLoading } = useDeviceFormSubmission({
    device,
    currentProjectId,
    onSuccess,
    adminMode,
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
