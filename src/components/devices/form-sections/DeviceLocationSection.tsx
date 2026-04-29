import { useRef } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
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
  form: UseFormReturn<any>;
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
  selectedZoneId,
  filteredDoors,
}: DeviceLocationSectionProps) {
  const userChangedZone = useRef(false);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pb-2">Konum Bilgileri</h3>
      
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

      <FormField
        control={form.control}
        name="door_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Kapı</FormLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value || undefined);
              }}
              disabled={!selectedZoneId || locationLoading}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      !selectedZoneId 
                        ? "Önce bölge seçiniz" 
                        : filteredDoors.length === 0 
                          ? "Seçili bölgede kapı yok" 
                          : "Kapı seçiniz"
                    } 
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {filteredDoors.map((door) => (
                  <SelectItem key={door.id} value={String(door.id)}>
                    {door.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
