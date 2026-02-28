
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
  projects,
  onSuccess,
}: DeviceFormProps) {
  const {
    form,
    isLoading,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    filteredDoors,
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
    <div className="flex flex-col h-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-6">
            <div className="space-y-6">
              {/* Two-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                {/* Left Column */}
                <div className="space-y-6">
                  <DeviceBasicSection form={form} />
                  <DeviceNetworkSection form={form} isNewDevice={!device} />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
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
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="border-t border-border/50 bg-muted/30 px-6 py-5 md:px-8 md:py-5 flex-shrink-0">
            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isLoading}
                className="px-6 py-2.5 font-medium"
              >
                İptal
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="bg-burgundy hover:bg-burgundy/90 px-6 py-2.5 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoading ? "Kaydediliyor..." : device ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
