
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

interface Zone {
  id: number;
  name: string;
}

interface Door {
  id: number;
  name: string;
  zone_id: number;
}

interface ZoneDoorTreeProps {
  onSelectDoor?: (doorId: number) => void;
  onSelectZone?: (zoneId: number) => void;
}

export const ZoneDoorTree = ({
  onSelectDoor,
  onSelectZone,
}: ZoneDoorTreeProps) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<number | null>(null);

  useEffect(() => {
    fetchZonesAndDoors();
  }, []);

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

  const handleZoneClick = (zoneId: number) => {
    setSelectedZone(zoneId === selectedZone ? null : zoneId);
    setSelectedDoor(null);
    onSelectZone?.(zoneId === selectedZone ? null : zoneId);
  };

  const handleDoorClick = (doorId: number) => {
    setSelectedDoor(doorId);
    onSelectDoor?.(doorId);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <ListTree className="h-4 w-4" />
        Bölgeler &amp; Kapılar
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {zones.map((zone) => (
            <SidebarMenuItem key={zone.id}>
              <SidebarMenuButton
                onClick={() => handleZoneClick(zone.id)}
                className={cn(
                  "font-medium",
                  selectedZone === zone.id && "bg-burgundy/10 text-burgundy"
                )}
              >
                {zone.name}
              </SidebarMenuButton>
              {selectedZone === zone.id && (
                <div className="ml-4 mt-1 w-full">
                  {doors.filter((door) => door.zone_id === zone.id).length === 0 ? (
                    <div className="text-xs text-muted-foreground pl-2">Kapı yok</div>
                  ) : (
                    doors
                      .filter((door) => door.zone_id === zone.id)
                      .map((door) => (
                        <SidebarMenuButton
                          key={door.id}
                          onClick={() => handleDoorClick(door.id)}
                          className={cn(
                            "text-sm ml-6 mt-1",
                            selectedDoor === door.id && "bg-primary/10 text-primary"
                          )}
                        >
                          ⎯ {door.name}
                        </SidebarMenuButton>
                      ))
                  )}
                </div>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
