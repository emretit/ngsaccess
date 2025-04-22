
import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [expandedZones, setExpandedZones] = useState<{ [key: number]: boolean }>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    setExpandedZones(prev => ({
      ...prev,
      [zoneId]: !prev[zoneId]
    }));
    setSelectedId(`zone-${zoneId}`);
    onSelectZone?.(zoneId);
  };

  const handleDoorClick = (doorId: number) => {
    setSelectedId(`door-${doorId}`);
    onSelectDoor?.(doorId);
  };

  return (
    <aside className="w-64 min-w-[220px] max-w-xs border-r bg-card h-full p-2 overflow-y-auto rounded-xl shadow-sm">
      <h3 className="text-lg font-semibold px-2 mb-2">Bölgeler &amp; Kapılar</h3>
      <ul>
        {zones.map(zone => (
          <li key={zone.id} className="mb-1">
            <div
              role="button"
              className={cn(
                "flex items-center gap-2 font-medium px-2 py-1 rounded cursor-pointer select-none hover:bg-accent transition",
                selectedId === `zone-${zone.id}` && "bg-accent"
              )}
              onClick={() => handleZoneClick(zone.id)}
            >
              {expandedZones[zone.id] ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <span>{zone.name}</span>
            </div>
            {expandedZones[zone.id] &&
              <ul className="ml-7 mt-1">
                {doors
                  .filter(door => door.zone_id === zone.id)
                  .map(door => (
                    <li key={door.id}>
                      <div
                        role="button"
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-primary/10 cursor-pointer transition",
                          selectedId === `door-${door.id}` && "bg-primary/10"
                        )}
                        onClick={() => handleDoorClick(door.id)}
                      >
                        <span>⎯ {door.name}</span>
                      </div>
                    </li>
                  ))}
                {doors.filter(door => door.zone_id === zone.id).length === 0 && (
                  <div className="pl-2 text-xs text-muted-foreground">Kapı yok</div>
                )}
              </ul>
            }
          </li>
        ))}
      </ul>
    </aside>
  );
};
