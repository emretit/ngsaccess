
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ServerDevice, Project } from "@/types/device";
import { useDeviceFormLogic } from "./hooks/useDeviceFormLogic";
import { DeviceBasicSection } from "./form-sections/DeviceBasicSection";
import { DeviceLocationSection } from "./form-sections/DeviceLocationSection";
import { DeviceNetworkSection } from "./form-sections/DeviceNetworkSection";
import { DeviceStatusSection } from "./form-sections/DeviceStatusSection";
import { DeviceHikvisionSection } from "./form-sections/DeviceHikvisionSection";
import type { DeviceBrand } from "./hooks/useDeviceFormSchema";

interface DeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: (ServerDevice & { _id?: Id<"devices"> }) | null;
  projects: Project[];
  defaultBrand?: DeviceBrand;
  onBack?: () => void;
  onSuccess: () => void;
}

export function DeviceForm({
  open,
  onClose,
  device,
  projects: _projects,
  defaultBrand,
  onBack,
  onSuccess,
}: DeviceFormProps) {
  const {
    form,
    isLoading,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    filteredDoors: _filteredDoors,
    onSubmit,
  } = useDeviceFormLogic({ device, open, defaultBrand, onSuccess });

  if (!open) return null;

  // Zone/door ID mapping for form components (expect .id; Convex uses _id)
  const zonesForForm = zones.map((z) => ({ ...z, id: z._id }));
  const doorsForForm = doors.map((d) => ({ ...d, id: d._id, zone_id: d.zoneId }));
  const filteredDoorsForForm = doorsForForm.filter(
    (d) => String(d.zone_id) === String(selectedZoneId)
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const brand = form.watch("brand");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-5">
            <DeviceBasicSection form={form} />
            {brand !== "hikvision" && <DeviceNetworkSection form={form} />}
          </div>

          <div className="space-y-5">
            <DeviceLocationSection
              form={form}
              zones={zonesForForm}
              doors={doorsForForm}
              locationLoading={locationLoading}
              selectedZoneId={selectedZoneId}
              filteredDoors={filteredDoorsForForm}
            />
            <DeviceStatusSection form={form} />
          </div>
        </div>

        {brand === "hikvision" && (
          <DeviceHikvisionSection
            form={form}
            device={device}
            onUpdated={onSuccess}
          />
        )}

        <div className="flex justify-between gap-2 pt-4 border-t">
          {onBack && !device ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={isLoading}
            >
              ← Marka Seç
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Kaydediliyor..." : device ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
