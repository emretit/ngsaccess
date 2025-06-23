
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
  device?: ServerDevice | null;
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

  return (
    <div className="flex flex-col h-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8">
              {/* Modern Two-Column Equal Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                  <DeviceBasicSection form={form} />
                  <DeviceLocationSection 
                    form={form}
                    zones={zones}
                    doors={doors}
                    locationLoading={locationLoading}
                    selectedZoneId={selectedZoneId}
                    filteredDoors={filteredDoors}
                  />
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  <DeviceNetworkSection form={form} />
                  <DeviceStatusSection form={form} />
                </div>
              </div>
            </div>
          </div>

          {/* Modern Fixed Footer */}
          <div className="border-t bg-white/80 backdrop-blur-sm p-8 flex-shrink-0">
            <div className="flex justify-end space-x-4">
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
