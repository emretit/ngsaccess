
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/types/device";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Zone, Door } from "@/types/access-control";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface AssignLocationFormProps {
  device: Device;
}

export function AssignLocationForm({ device }: AssignLocationFormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(device.zone_id ? String(device.zone_id) : null);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(device.door_id ? String(device.door_id) : null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    async function fetchZonesAndDoors() {
      const { data: zonesData } = await supabase
        .from("zones")
        .select("*")
        .order("name", { ascending: true });

      const { data: doorsData } = await supabase
        .from("doors")
        .select("*")
        .order("name", { ascending: true });

      if (zonesData) setZones(zonesData);
      if (doorsData) setDoors(doorsData);
    }
    fetchZonesAndDoors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('devices')
      .update({ 
        zone_id: selectedZone ? parseInt(selectedZone) : null,
        door_id: selectedDoor ? parseInt(selectedDoor) : null 
      })
      .eq('id', device.id.toString()); // Convert to string to match the id type expected by Supabase

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
            {doors.filter(door => door.zone_id === (selectedZone ? parseInt(selectedZone) : null)).map((door) => (
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
