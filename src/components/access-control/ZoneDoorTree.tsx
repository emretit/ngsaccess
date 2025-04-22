
import { useEffect, useState } from "react";
import { ChevronRight, Grid } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
  selectedZone: number | null;
  onSelectZone: (id: number | null) => void;
  selectedDoor: number | null;
  onSelectDoor: (id: number | null) => void;
}

export function ZoneDoorTree({
  selectedZone,
  onSelectZone,
  selectedDoor,
  onSelectDoor,
}: ZoneDoorTreeProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [expandedZones, setExpandedZones] = useState<number[]>([]);

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

  const handleZoneToggle = (zoneId: number) => {
    setExpandedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((z) => z !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleZoneSelect = (zoneId: number) => {
    if (selectedZone === zoneId) {
      onSelectZone(null);
      setExpandedZones((prev) => prev.filter((z) => z !== zoneId));
    } else {
      onSelectZone(zoneId);
      setExpandedZones((prev) =>
        prev.includes(zoneId) ? prev : [...prev, zoneId]
      );
      onSelectDoor(null);
    }
  };

  const handleDoorSelect = (doorId: number) => {
    onSelectDoor(doorId === selectedDoor ? null : doorId);
  };

  return (
    <>
      {zones.map((zone) => {
        const isExpanded = expandedZones.includes(zone.id);
        const zoneDoors = doors.filter((d) => d.zone_id === zone.id);
        return (
          <li role="treeitem" aria-expanded={isExpanded} key={zone.id}>
            <div
              className={cn(
                "group flex items-center gap-1 rounded-md p-2 transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                selectedZone === zone.id && "bg-accent/80 text-accent-foreground font-medium",
                "mt-0.5"
              )}
              style={{ paddingLeft: "16px" }}
              onClick={() => handleZoneSelect(zone.id)}
              tabIndex={0}
            >
              <button
                type="button"
                className="h-5 w-5 p-0 hover:bg-transparent bg-transparent focus:outline-none focus:ring-0 border-none"
                onClick={e => {
                  e.stopPropagation();
                  handleZoneToggle(zone.id);
                }}
                tabIndex={-1}
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>
              <Grid className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{zone.name}</span>
            </div>
            {zoneDoors.length > 0 && isExpanded && (
              <ul
                role="group"
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {zoneDoors.map((door) => (
                  <li key={door.id} role="treeitem" className="mt-0.5">
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md p-2 transition-all ml-6 text-sm",
                        "hover:bg-primary/10 hover:text-primary",
                        selectedDoor === door.id && "bg-primary/10 text-primary font-medium"
                      )}
                      onClick={() => handleDoorSelect(door.id)}
                      tabIndex={0}
                    >
                      <span className="mr-2">⎯</span>
                      <span className="flex-1 truncate">{door.name}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}
