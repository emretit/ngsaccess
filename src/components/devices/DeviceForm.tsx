
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ServerDevice, Project } from "@/types/device";
import { useDeviceFormLogic } from "./hooks/useDeviceFormLogic";
import { DeviceBasicSection } from "./form-sections/DeviceBasicSection";
import { DeviceLocationSection } from "./form-sections/DeviceLocationSection";
import { DeviceNetworkSection } from "./form-sections/DeviceNetworkSection";
import { DeviceStatusSection } from "./form-sections/DeviceStatusSection";

interface DeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: (ServerDevice & { _id?: Id<"devices"> }) | null;
  projects: Project[];
  onSuccess: () => void;
}

export function DeviceForm({
  open,
  onClose,
  device,
  projects: _projects,
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
  } = useDeviceFormLogic({ device, open, onSuccess });

  if (!open) return null;

  // Zone/door ID mapping for form components (expect .id; Convex uses _id)
  const zonesForForm = zones.map((z) => ({ ...z, id: z._id }));
  const doorsForForm = doors.map((d) => ({ ...d, id: d._id, zone_id: d.zoneId }));
  const filteredDoorsForForm = doorsForForm.filter(
    (d) => String(d.zone_id) === String(selectedZoneId)
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-5">
            <DeviceBasicSection form={form} />
            <DeviceNetworkSection form={form} isNewDevice={!device} />
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

        <div className="flex justify-end gap-2 pt-4 border-t">
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
      </form>
    </Form>
  );
}
