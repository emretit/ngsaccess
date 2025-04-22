
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp } from "lucide-react";
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

  const handleZoneClick = (zoneId: number) => {
    setSelectedZone(zoneId === selectedZone ? null : zoneId);
    setSelectedDoor(null);
    onSelectZone?.(zoneId === selectedZone ? null : zoneId);
    // expand/collapse mantığı
    setExpandedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((z) => z !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleDoorClick = (doorId: number) => {
    setSelectedDoor(doorId);
    onSelectDoor?.(doorId);
  };

  return (
    <ul role="tree" className="space-y-0.5">
      {zones.map((zone) => {
        const isExpanded = expandedZones.includes(zone.id);
        const zoneDoors = doors.filter((door) => door.zone_id === zone.id);

        return (
          <li key={zone.id} role="treeitem" aria-expanded={isExpanded}>
            <div
              className={cn(
                "group flex items-center gap-1 rounded-md p-2 transition-all cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground",
                selectedZone === zone.id && "bg-accent/80 text-accent-foreground font-medium"
              )}
              onClick={() => handleZoneClick(zone.id)}
            >
              <button
                type="button"
                className="h-5 w-5 p-1 flex items-center justify-center rounded hover:bg-accent/40 focus:outline-none mr-1"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedZones((prev) =>
                    prev.includes(zone.id)
                      ? prev.filter((z) => z !== zone.id)
                      : [...prev, zone.id]
                  );
                }}
                aria-label={isExpanded ? "Kapat" : "Aç"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground/70" />
                )}
              </button>
              <span className="flex-1 truncate text-sm">{zone.name}</span>
            </div>
            {/* Doors */}
            {isExpanded && (
              <ul role="group" className="pl-6">
                {zoneDoors.length === 0 ? (
                  <div className="text-xs text-muted-foreground pl-2 pb-2">Kapı yok</div>
                ) : (
                  zoneDoors.map((door) => (
                    <li key={door.id}>
                      <div
                        className={cn(
                          "flex items-center rounded-md px-2 py-1.5 ml-2 cursor-pointer text-sm",
                          "hover:bg-primary/10 hover:text-primary",
                          selectedDoor === door.id && "bg-primary/10 text-primary font-medium"
                        )}
                        onClick={() => handleDoorClick(door.id)}
                      >
                        <span className="ml-3">⎯ {door.name}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};
