
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/types/device";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Zone, Door } from "@/types/access-control";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";

interface AssignLocationFormProps {
  device: Device;
}

export function AssignLocationForm({ device }: AssignLocationFormProps) {
  const { zones, doors, loading } = useZonesAndDoors();
  const [selectedZone, setSelectedZone] = useState<string | null>(device.zone_id ? String(device.zone_id) : null);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(device.door_id ? String(device.door_id) : null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Seçilen bölgeye göre filtrelenmiş kapılar
  const filteredDoors = doors.filter(door => 
    selectedZone && String(door.zone_id) === selectedZone
  );

  // Bölge değiştiğinde kapı seçimini sıfırlama
  useEffect(() => {
    if (selectedZone) {
      // Eğer seçili kapı varsa ve bölge değiştiyse, kapıyı sıfırla
      if (selectedDoor) {
        const doorExists = filteredDoors.some(door => String(door.id) === selectedDoor);
        if (!doorExists) {
          setSelectedDoor(null);
        }
      }
    } else {
      setSelectedDoor(null); // Bölge seçili değilse kapı da sıfırlanmalı
    }
  }, [selectedZone, filteredDoors, selectedDoor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('devices')
      .update({ 
        zone_id: selectedZone ? parseInt(selectedZone) : null,
        door_id: selectedDoor ? parseInt(selectedDoor) : null 
      })
      .eq('id', device.id);

    if (error) {
      toast({
        title: "Hata",
        description: "Konum güncellenirken bir hata oluştu",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Başarılı",
      description: "Konum güncellendi",
    });

    // Refresh the devices data after successful update
    queryClient.invalidateQueries({ queryKey: ['devices'] });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="zone">Bölge</Label>
        <Select value={selectedZone || ''} onValueChange={setSelectedZone}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={loading ? "Yükleniyor..." : "Bölge Seç"} />
          </SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={String(zone.id)}>
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="door">Kapı</Label>
        <Select 
          value={selectedDoor || ''} 
          onValueChange={setSelectedDoor}
          disabled={!selectedZone || filteredDoors.length === 0}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue 
              placeholder={
                !selectedZone 
                  ? "Önce bölge seçin" 
                  : filteredDoors.length === 0 
                    ? "Bu bölgede kapı yok" 
                    : "Kapı Seç"
              } 
            />
          </SelectTrigger>
          <SelectContent>
            {filteredDoors.map((door) => (
              <SelectItem key={door.id} value={String(door.id)}>
                {door.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" size="sm">
        Kaydet
      </Button>
    </form>
  );
}
