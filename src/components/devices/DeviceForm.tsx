
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ServerDevice, Project } from "@/types/device";
import { useDeviceFormLogic } from "./hooks/useDeviceFormLogic";
import { DeviceBasicSection } from "./form-sections/DeviceBasicSection";
import { DeviceLocationSection } from "./form-sections/DeviceLocationSection";
import { DeviceNetworkSection } from "./form-sections/DeviceNetworkSection";
import { DeviceStatusSection } from "./form-sections/DeviceStatusSection";
import { DeviceHikvisionSection } from "./form-sections/DeviceHikvisionSection";
import { DeviceIdeSmartSection } from "./form-sections/DeviceIdeSmartSection";
import { DeviceNameSection } from "./form-sections/DeviceNameSection";
import { DeviceZoneSection } from "./form-sections/DeviceZoneSection";
import type { DeviceBrand } from "./hooks/useDeviceFormSchema";

interface DeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: (ServerDevice & { _id?: Id<"devices"> }) | null;
  projects: Project[];
  defaultBrand?: DeviceBrand;
  onBack?: () => void;
  onSuccess: () => void;
  /** Admin akışı: cihazı aktif proje yerine seçilen projeye yazar. */
  projectIdOverride?: Id<"projects"> | null;
  /** Admin modu: yalnız bağlantı kimliği alanları; isim/bölge/kapı/yön/tip/durum gizli. */
  adminMode?: boolean;
}

export function DeviceForm({
  open,
  onClose,
  device,
  projects: _projects,
  defaultBrand,
  onBack,
  onSuccess,
  projectIdOverride,
  adminMode,
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
  } = useDeviceFormLogic({ device, open, defaultBrand, onSuccess, projectIdOverride, adminMode });

  if (!open) return null;

  // Zone/door ID mapping for form components (expect .id; Convex uses _id)
  const zonesForForm = zones.map((z) => ({ ...z, id: z._id }));
  const doorsForForm = doors.map((d) => ({ ...d, id: d._id, zone_id: d.zoneId }));
  const filteredDoorsForForm = doorsForForm.filter(
    (d) => String(d.zone_id) === String(selectedZoneId)
  );

  const brand = form.watch("brand");

  const isIdeSmart = brand === "ide_smart";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-5">
        {adminMode ? (
          // Admin: yalnız bağlantı kimliği. İsim seri/UUID'den türetilir; bölge,
          // kapı, erişim yönü, tip, durum proje tarafında kararlaştırılır.
          brand === "ide_smart" ? (
            <DeviceIdeSmartSection form={form} />
          ) : (
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="device_serial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seri Numarası</FormLabel>
                    <FormControl>
                      <Input placeholder="Seri numarasını giriniz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {brand === "other" && <DeviceNetworkSection form={form} />}
            </div>
          )
        ) : isIdeSmart ? (
          // IDE Smart paneli: panel adı + bölge (ayrı seçim) + bağlantı; kapılar
          // otomatik üretilir. Serial/type alanları gizli.
          <div className="space-y-5">
            <DeviceNameSection form={form} />
            <DeviceZoneSection form={form} zones={zonesForForm} allowCreate={!device} />
            <DeviceIdeSmartSection form={form} />
            <DeviceStatusSection form={form} />
          </div>
        ) : (
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
        )}

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
