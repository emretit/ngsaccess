
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { Zone, Door } from "@/hooks/useZonesAndDoors";

interface DeviceLocationSectionProps {
  form: UseFormReturn<any>;
  zones: Zone[];
  doors: Door[];
  locationLoading: boolean;
  selectedZoneId: number | undefined;
  filteredDoors: Door[];
}

export function DeviceLocationSection({ 
  form, 
  zones, 
  locationLoading, 
  selectedZoneId, 
  filteredDoors 
}: DeviceLocationSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium border-b pb-2">Konum Bilgileri</h3>
      
      <FormField
        control={form.control}
        name="zone_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bölge</FormLabel>
            <Select 
              value={field.value?.toString() || ""} 
              onValueChange={(value) => {
                const newZoneId = value ? parseInt(value) : undefined;
                field.onChange(newZoneId);
                
                // Kapı seçimini sıfırlama - sadece mevcut kapı yeni bölgeye ait değilse
                const currentDoorId = form.getValues("door_id");
                if (currentDoorId && newZoneId !== selectedZoneId) {
                  // Mevcut kapının yeni bölgeye ait olup olmadığını kontrol et
                  const doorBelongsToNewZone = filteredDoors.some(door => 
                    door.id === currentDoorId && door.zone_id === newZoneId
                  );
                  
                  // Eğer kapı yeni bölgeye ait değilse sıfırla
                  if (!doorBelongsToNewZone) {
                    form.setValue("door_id", undefined);
                  }
                }
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={locationLoading ? "Yükleniyor..." : "Bölge seçiniz"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {zones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id.toString()}>
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
              value={field.value?.toString() || ""} 
              onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
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
                {filteredDoors.map(door => (
                  <SelectItem key={door.id} value={door.id.toString()}>
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
