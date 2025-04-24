import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/types/device";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Zone, Door } from "@/types/access-control";
import { useToast } from "@/hooks/use-toast";

interface AssignLocationFormProps {
  device: Device;
}

export function AssignLocationForm({ device }: AssignLocationFormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(device.zone_id ? String(device.zone_id) : null);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(device.door_id ? String(device.door_id) : null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchZonesAndDoors() {
      const { data: zonesData } = await supabase
        .from("zones")
        .select("id, name")
        .order("name", { ascending: true });

      const { data: doorsData } = await supabase
        .from("doors")
        .select("id, name, zone_id")
        .order("name", { ascending: true });

      setZones(zonesData || []);
      setDoors(doorsData || []);
    }
    fetchZonesAndDoors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('devices')
      .update({ 
        zone_id: selectedZone ? Number(selectedZone) : null,
        door_id: selectedDoor ? Number(selectedDoor) : null 
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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="zone">Bölge</Label>
        <Select value={selectedZone} onValueChange={setSelectedZone}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Bölge Seç" />
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
        <Select value={selectedDoor} onValueChange={setSelectedDoor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kapı Seç" />
          </SelectTrigger>
          <SelectContent>
            {doors.filter(door => door.zone_id === Number(selectedZone)).map((door) => (
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
