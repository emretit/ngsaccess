import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";

/** Yeni bölge oluşturma seçeneği için sentinel (gerçek bir zone id'si değil). */
export const NEW_ZONE_VALUE = "__new__";

interface DeviceZoneSectionProps {
  form: UseFormReturn<FormValues>;
  zones: ReadonlyArray<{ _id: string; name: string }>;
  /** Düzenleme modunda yeni bölge oluşturma kapatılır (yalnızca mevcut bölge seçilir). */
  allowCreate?: boolean;
}

/**
 * Panel/cihaz için bölge (mantıksal alan) seçimi. Panel adından bağımsızdır.
 * "+ Yeni bölge oluştur" seçilince ad girişi açılır (new_zone_name).
 */
export function DeviceZoneSection({ form, zones, allowCreate = true }: DeviceZoneSectionProps) {
  const zoneId = form.watch("zone_id");
  const isNew = zoneId === NEW_ZONE_VALUE;

  return (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name="zone_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bölge</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                if (value !== NEW_ZONE_VALUE) form.setValue("new_zone_name", "");
              }}
              value={field.value ?? undefined}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Bölge seçin veya oluşturun" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone._id} value={zone._id}>
                    {zone.name}
                  </SelectItem>
                ))}
                {allowCreate && (
                  <SelectItem value={NEW_ZONE_VALUE}>+ Yeni bölge oluştur</SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormDescription>Panelin bulunduğu mantıksal alan (panel adından bağımsız).</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {isNew && (
        <FormField
          control={form.control}
          name="new_zone_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Yeni Bölge Adı</FormLabel>
              <FormControl>
                <Input placeholder="Örn. Giriş Katı" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
