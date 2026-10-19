import { useEffect, useRef } from "react";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";

import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ServerDevice, Project } from "@/types/device";
import { useDeviceFormLogic } from "./hooks/useDeviceFormLogic";
import { DeviceBasicSection, DeviceTypeField } from "./form-sections/DeviceBasicSection";
import { DeviceLocationSection } from "./form-sections/DeviceLocationSection";
import { DeviceNetworkSection } from "./form-sections/DeviceNetworkSection";
import { DeviceStatusSection } from "./form-sections/DeviceStatusSection";
import { DeviceHikvisionSection } from "./form-sections/DeviceHikvisionSection";
import { DeviceIdeSmartSection } from "./form-sections/DeviceIdeSmartSection";
import { DeviceNameSection } from "./form-sections/DeviceNameSection";
import { DeviceZoneSection } from "./form-sections/DeviceZoneSection";
import { BRAND_LABELS } from "./hooks/useDeviceFormSchema";
import { topologyPreview } from "./topologyPreview";
import type { DeviceBrand } from "./hooks/useDeviceFormSchema";

interface DeviceFormProps {
  onStateChange?: (brand: DeviceBrand, dirty: boolean, pending: boolean) => void;
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
  onStateChange,
  onClose,
  device,
  projects,
  defaultBrand,
  onBack,
  onSuccess,
  projectIdOverride,
  adminMode,
}: DeviceFormProps) {
  const {
    form,
    isLoading,
    connectionError,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    currentProjectId,
    filteredDoors: _filteredDoors,
    onSubmit,
  } = useDeviceFormLogic({ device, defaultBrand, onSuccess, projectIdOverride, adminMode });

  const formElement = useRef<HTMLFormElement>(null);
  const focusFirstError = () => {
    const control = formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    control?.closest("details")?.setAttribute("open", "");
    control?.focus();
  };
  const dirty = form.formState.isDirty;
  const guard = useUnsavedChangesGuard(!onStateChange && dirty);
  const formBrand = defaultBrand ?? device?.brand ?? "other";
  useEffect(() => { onStateChange?.(formBrand, dirty, isLoading); }, [onStateChange, formBrand, dirty, isLoading]);
  const close = () => { if (!isLoading) { if (onStateChange) onClose(); else guard.requestClose(onClose); } };
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
      <form ref={formElement} onSubmit={event => { void form.handleSubmit(onSubmit, () => requestAnimationFrame(focusFirstError))(event); }} className="min-w-0 space-y-4" noValidate aria-busy={isLoading}>
        <p className="text-sm text-muted-foreground">Proje: {projects.find(project => project._id === currentProjectId)?.name ?? "Seçili proje"}</p>
        {Object.keys(form.formState.errors).length > 0 && <div role="alert" className="rounded-md border border-danger p-3 text-sm">
          <p className="font-medium">Kaydedilemedi. İşaretli alanları kontrol edin.</p>
          <ul className="mt-1 list-disc pl-4">{Object.entries(form.formState.errors).map(([key, error]) => error && typeof error.message === "string" ? <li key={key}>{error.message}</li> : null)}</ul>
          <button type="button" className="mt-2 underline focus-visible:ring-2 focus-visible:ring-ring" onClick={focusFirstError}>İlk hatalı alana git</button>
        </div>}
        <fieldset disabled={isLoading || !!connectionError} className="space-y-4">
        {adminMode ? (
          // Admin: yalnız bağlantı kimliği. İsim seri/UUID'den türetilir; bölge,
          // kapı, erişim yönü, tip, durum proje tarafında kararlaştırılır.
          brand === "ide_smart" ? (
            <DeviceIdeSmartSection form={form} isEdit={!!device} />
          ) : (
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="device_serial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seri numarası</FormLabel>
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
            <DeviceIdeSmartSection form={form} isEdit={!!device} />
            <DeviceStatusSection form={form} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-4">
              <DeviceBasicSection form={form} isEdit={!!device} />
              {brand !== "hikvision" && <DeviceNetworkSection form={form} />}
            </div>

            <div className="space-y-4">
              <DeviceLocationSection
                form={form}
                zones={zonesForForm}
                doors={doorsForForm}
                locationLoading={locationLoading}
                selectedZoneId={selectedZoneId}
                filteredDoors={filteredDoorsForForm}
                allowCreate={!device}
              />
              <DeviceStatusSection form={form} />
              <DeviceTypeField form={form} />
            </div>
          </div>
        )}

        {brand === "hikvision" && (
          <DeviceHikvisionSection
            form={form}
            device={device}
            onUpdated={() => {}}
          />
        )}

        {!adminMode && (
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Açıklama</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Cihaz hakkında açıklama giriniz"
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        </fieldset>
        {connectionError && <p role="alert" className="text-sm text-destructive">{connectionError}</p>}
        {!device && <section className="space-y-1 border-t border-line pt-4 pb-24 text-sm" aria-label="Kayıt özeti">
          <h3 className="font-medium">Kaydetmeden önce gözden geçirin</h3>
          <p className="break-words">{form.watch("name") || "Cihaz adı girilmedi"} · {BRAND_LABELS[brand]}</p>
          <p className="break-words text-muted-foreground">{selectedZoneId === "__new__" ? `Yeni bölge: ${form.watch("new_zone_name") || "Ad girilmedi"}` : zones.find(zone => zone._id === selectedZoneId)?.name ?? "Bölge seçilmedi"}</p>
          <p className="text-muted-foreground">{topologyPreview(form.watch())}</p>
        </section>}
        {device && <p className="text-sm text-muted-foreground">Model ve kapı sayısı mevcut kapı/okuyucu yapısını değiştirmez. Topoloji düzenleme bu ekranda desteklenmiyor.</p>}
        <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t border-line bg-surface py-4">
          {onBack && !device ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={isLoading || !!connectionError}
            >
              Marka seç
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isLoading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Kaydediliyor..." : connectionError ? "Bağlantıyı tekrar dene" : device ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </div>
        {guard.dialog}
      </form>
    </Form>
  );
}
