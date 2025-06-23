
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { Zone, Door } from "@/hooks/useZonesAndDoors";
import { useRef } from "react";

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
  // Kullanıcının aktif olarak bölge değiştirdiğini takip etmek için ref kullanıyoruz
  const userInitiatedZoneChange = useRef(false);

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
                console.log('Zone changing from', selectedZoneId, 'to', newZoneId);
                console.log('User initiated change:', userInitiatedZoneChange.current);
                
                // Kullanıcının aktif olarak bölge değiştirdiğini işaretle
                userInitiatedZoneChange.current = true;
                
                field.onChange(newZoneId);
                
                // Sadece kullanıcı aktif olarak bölge değiştiriyorsa ve yeni bölge farklıysa kapı seçimini kontrol et
                if (userInitiatedZoneChange.current && newZoneId !== selectedZoneId) {
                  const currentDoorId = form.getValues("door_id");
                  console.log('Current door_id:', currentDoorId);
                  
                  // Mevcut kapı seçili bölgeye ait değilse sıfırla
                  if (currentDoorId) {
                    const doorBelongsToNewZone = filteredDoors.some(door => door.id === currentDoorId);
                    console.log('Door belongs to new zone:', doorBelongsToNewZone);
                    
                    if (!doorBelongsToNewZone) {
                      console.log('Clearing door_id because it does not belong to new zone');
                      form.setValue("door_id", undefined);
                    }
                  }
                }
                
                // Bir sonraki değişiklik için reset et
                setTimeout(() => {
                  userInitiatedZoneChange.current = false;
                }, 100);
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
              onValueChange={(value) => {
                console.log('Door changing to:', value);
                field.onChange(value ? parseInt(value) : undefined);
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
