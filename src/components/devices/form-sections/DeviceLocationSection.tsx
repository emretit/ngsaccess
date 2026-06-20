import { useRef } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
interface ZoneForForm {
  id: string;
  name: string;
}

interface DoorForForm {
  id: string;
  name: string;
  zone_id?: string;
}

interface DeviceLocationSectionProps {
  form: UseFormReturn<FormValues>;
  zones: ZoneForForm[];
  doors: DoorForForm[];
  locationLoading: boolean;
  selectedZoneId: string | undefined;
  filteredDoors: DoorForForm[];
}

export function DeviceLocationSection({
  form,
  zones,
  locationLoading,
  filteredDoors,
}: DeviceLocationSectionProps) {
  const userChangedZone = useRef(false);
  // Hikvision'da kapı sayısı modelden türetilir (DeviceHikvisionSection) → generic
  // "Kapı Sayısı" select'ini gizle. Diğer markalarda eski davranış korunur.
  const brand = form.watch("brand");
  const showDoorCount = brand !== "hikvision";

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="zone_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bölge</FormLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                if (!value) return;

                userChangedZone.current = true;

                if (value !== field.value) {
                  field.onChange(value);

                  if (userChangedZone.current) {
                    const currentDoorId = form.getValues("door_id");

                    if (currentDoorId) {
                      const doorBelongsToNewZone = filteredDoors.some(
                        (door) => String(door.id) === String(currentDoorId)
                      );

                      if (!doorBelongsToNewZone) {
                        form.setValue("door_id", undefined);
                      }
                    }
                  }
                }

                userChangedZone.current = false;
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={locationLoading ? "Yükleniyor..." : "Bölge seçiniz"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={String(zone.id)}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {showDoorCount && (
        <FormField
          control={form.control}
          name="door_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kapı Sayısı</FormLabel>
              <Select
                value={field.value ? String(field.value) : ""}
                onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Kapı sayısı seçiniz" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
