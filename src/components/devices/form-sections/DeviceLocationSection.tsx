
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { Zone, Door } from "@/hooks/useZonesAndDoors";
import { useRef, useEffect } from "react";

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
  const userChangedZone = useRef(false);
  const initialFormData = useRef<{ zone_id?: number; door_id?: number }>({});

  // Form değerleri ilk yüklendiğinde kaydet
  useEffect(() => {
    const currentZoneId = form.getValues("zone_id");
    const currentDoorId = form.getValues("door_id");
    
    if (currentZoneId && !initialFormData.current.zone_id) {
      initialFormData.current = {
        zone_id: currentZoneId,
        door_id: currentDoorId
      };
      console.log('Initial form data saved:', initialFormData.current);
    }
  }, [form]);

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
              value={field.value ? field.value.toString() : ""} 
              onValueChange={(value) => {
                if (!value) return;
                
                const newZoneId = parseInt(value);
                console.log('Zone selection changed to:', newZoneId);
                
                // Kullanıcının manuel değişiklik yaptığını işaretle
                userChangedZone.current = true;
                
                // Sadece değer gerçekten değişmişse güncelle
                if (newZoneId !== field.value) {
                  field.onChange(newZoneId);
                  
                  // Eğer kullanıcı manuel değişiklik yaptıysa kapı kontrolü yap
                  if (userChangedZone.current) {
                    const currentDoorId = form.getValues("door_id");
                    
                    if (currentDoorId) {
                      const doorBelongsToNewZone = filteredDoors.some(door => door.id === currentDoorId);
                      console.log('Checking if door belongs to new zone:', doorBelongsToNewZone);
                      
                      if (!doorBelongsToNewZone) {
                        console.log('Clearing door_id because it does not belong to new zone');
                        form.setValue("door_id", undefined);
                      }
                    }
                  }
                }
                
                // Reset flag
                userChangedZone.current = false;
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
              value={field.value ? field.value.toString() : ""} 
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
