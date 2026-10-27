import { FormFeedback } from "@/components/shared/FormFeedback";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";

import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ServerDevice, Project } from "@/types/device";
import { useDeviceFormLogic } from "./hooks/useDeviceFormLogic";
import {
  DeviceBasicSection,
  DeviceTypeField,
} from "./form-sections/DeviceBasicSection";
import { DeviceLocationSection } from "./form-sections/DeviceLocationSection";
import { DeviceNetworkSection } from "./form-sections/DeviceNetworkSection";
import { DeviceStatusSection } from "./form-sections/DeviceStatusSection";
import { FormActions } from "@/components/shared/FormActions";
import { DeviceHikvisionSection } from "./form-sections/DeviceHikvisionSection";
import { DeviceIdeSmartSection } from "./form-sections/DeviceIdeSmartSection";
import { DeviceNameSection } from "./form-sections/DeviceNameSection";
import { DeviceZoneSection } from "./form-sections/DeviceZoneSection";
import type { DeviceBrand } from "./hooks/useDeviceFormSchema";

interface DeviceFormProps {
  onStateChange?: (
    brand: DeviceBrand,
    dirty: boolean,
    pending: boolean,
  ) => void;
  open: boolean;
  disabled?: boolean;
  embedded?: boolean;
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

function DeviceFormSection({ title, columns = false, children }: { title: string; columns?: boolean; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-medium">{title}</legend>
      {columns ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div> : children}
    </fieldset>
  );
}

export function DeviceForm({
  open,
  disabled = false,
  embedded = false,
  onStateChange,
  onClose,
  device,
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
    onSubmit,
  } = useDeviceFormLogic({
    open,
    device,
    defaultBrand,
    onSuccess,
    projectIdOverride,
    adminMode,
  });

  const formElement = useRef<HTMLFormElement>(null);
  const focusFirstError = () => {
    const control = formElement.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    control?.closest("details")?.setAttribute("open", "");
    control?.focus();
  };
  const dirty = form.formState.isDirty;
  const guard = useUnsavedChangesGuard(!onStateChange && dirty);
  const formBrand = defaultBrand ?? device?.brand ?? "other";
  useEffect(() => {
    onStateChange?.(formBrand, dirty, isLoading);
  }, [onStateChange, formBrand, dirty, isLoading]);
  const close = () => {
    if (!isLoading) {
      if (onStateChange) onClose();
      else guard.requestClose(onClose);
    }
  };
  // Kayıt sırasında gateway bağlantısı kurulamamış cihaz: değişiklik olmadan da yeniden denenebilsin.
  const needsGatewayRegistration =
    !!device &&
    !device.hikDevIndex &&
    form.watch("brand") === "hikvision" &&
    form.watch("hik_transport") !== "localBridge" &&
    !!form.watch("ehome_id")?.trim();
  const undo = () => {
    form.reset(form.formState.defaultValues);
    requestAnimationFrame(() => form.setFocus("name"));
  };

  // Zone/door ID mapping for form components (expect .id; Convex uses _id)
  const zonesForForm = zones.map((z) => ({ ...z, id: z._id }));
  const doorsForForm = doors.map((d) => ({
    ...d,
    id: d._id,
    zone_id: d.zoneId,
  }));
  const filteredDoorsForForm = doorsForForm.filter(
    (d) => String(d.zone_id) === String(selectedZoneId),
  );

  const brand = form.watch("brand");

  const isIdeSmart = brand === "ide_smart";

  return (
    <Form {...form}>
      <form
        ref={formElement}
        onSubmit={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          void form.handleSubmit(onSubmit, () =>
            requestAnimationFrame(focusFirstError),
          )(event);
        }}
        className="min-w-0 space-y-4 [&_input]:h-9 [&_select]:h-9 [&_button[role=combobox]]:h-9 max-sm:[&_input]:min-h-11 max-sm:[&_button]:min-h-11 max-sm:[&_select]:min-h-11"
        noValidate
        aria-busy={isLoading}
      >
        {Object.keys(form.formState.errors).length > 0 && (
          <FormFeedback tone="error" variant="panel" title="Kaydedilemedi. İşaretli alanları kontrol edin.">
            <ul className="mt-1 list-disc pl-4">
              {Object.entries(form.formState.errors).map(([key, error]) =>
                error && typeof error.message === "string" ? (
                  <li key={key}>{error.message}</li>
                ) : null,
              )}
            </ul>
            <button
              type="button"
              className="mt-2 underline focus-visible:ring-2 focus-visible:ring-ring"
              onClick={focusFirstError}
            >
              İlk hatalı alana git
            </button>
          </FormFeedback>
        )}
        <fieldset
          aria-describedby={disabled ? "device-readonly-reason" : undefined}
          disabled={disabled || isLoading || !!connectionError}
          className="space-y-4"
        >
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
                        <Input
                          placeholder="Seri numarasını giriniz"
                          {...field}
                        />
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
            <div className="space-y-4">
              <DeviceFormSection title="Kimlik">
                <DeviceNameSection form={form} />
                <DeviceIdeSmartSection form={form} isEdit={!!device} section="identity" />
              </DeviceFormSection>
              <DeviceFormSection title="Konum" columns>
                <DeviceZoneSection
                  form={form}
                  zones={zonesForForm}
                  allowCreate={!device}
                />
                <DeviceStatusSection form={form} />
              </DeviceFormSection>
              <DeviceFormSection title="Bağlantı">
                <DeviceIdeSmartSection form={form} isEdit={!!device} section="connection" />
              </DeviceFormSection>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <DeviceFormSection title="Kimlik">
                <DeviceBasicSection form={form} isEdit={!!device} />
              </DeviceFormSection>
              <DeviceFormSection title="Konum" columns>
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
                {brand !== "hikvision" && <DeviceTypeField form={form} />}
              </DeviceFormSection>
              {brand !== "hikvision" && (
                <DeviceFormSection title="Bağlantı">
                  <DeviceNetworkSection form={form} />
                </DeviceFormSection>
              )}
            </div>
          )}

          {brand === "hikvision" && (
            <DeviceFormSection title="Bağlantı">
              <DeviceHikvisionSection form={form} device={device} />
            </DeviceFormSection>
          )}

          {!adminMode && (
            <DeviceFormSection title="Açıklama">
              <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Açıklama</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Cihaz hakkında açıklama giriniz"
                      className="min-h-14"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
            </DeviceFormSection>
          )}
        </fieldset>
        {connectionError && (
          <FormFeedback tone="error">
            {connectionError}
          </FormFeedback>
        )}
        {device && brand !== "hikvision" && (
          <p className="text-sm text-muted-foreground">
            Model ve kapı sayısı mevcut kapı/okuyucu yapısını değiştirmez.
            Topoloji düzenleme bu ekranda desteklenmiyor.
          </p>
        )}
        {!disabled && embedded && !dirty && !isLoading && needsGatewayRegistration && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3 text-sm">
            <p>Cihaz gateway'e henüz kaydedilmedi.</p>
            <Button type="submit" variant="outline" className="max-sm:min-h-11">
              Gateway'e bağla
            </Button>
          </div>
        )}
        {!disabled && embedded && (dirty || isLoading) && (
          <FormActions
            isLoading={isLoading}
            onClose={undo}
            cancelLabel="Değişiklikleri geri al"
            className="-mx-5"
          />
        )}
        {!disabled && !embedded && (
          <div className="sticky bottom-0 -mx-5 px-5 flex flex-wrap justify-between gap-3 border-t bg-background py-3">
            {onBack && !device ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={isLoading || !!connectionError}
              >
                <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
                Geri
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
                Vazgeç
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? "Kaydediliyor..."
                  : connectionError
                    ? "Bağlantıyı tekrar dene"
                    : "Kaydet"}
              </Button>
            </div>
          </div>
        )}
        {guard.dialog}
      </form>
    </Form>
  );
}
