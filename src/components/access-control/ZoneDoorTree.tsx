
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, SquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modern DepartmentTree'ye stil ve yapı uyumlu bir zone/door tree.
 */
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

  // Tree UI modernize edildi (ikoncuklar, spacing, hover, select: department tree gibi)
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
              style={{ paddingLeft: "12px" }}
              onClick={() => {
                setSelectedZone(zone.id === selectedZone ? null : zone.id);
                setSelectedDoor(null);
                onSelectZone?.(zone.id === selectedZone ? null : zone.id);
                setExpandedZones((prev) =>
                  prev.includes(zone.id)
                    ? prev.filter((z) => z !== zone.id)
                    : [...prev, zone.id]
                );
              }}
              tabIndex={0}
            >
              {/* Açma/kapatma ikoncuk */}
              <button
                type="button"
                className="h-5 w-5 p-0 flex items-center justify-center rounded hover:bg-accent/40 focus:outline-none mr-1"
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
                  <ChevronDown className="h-4 w-4 text-muted-foreground/70 transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70 transition-transform" />
                )}
              </button>
              <span className="flex-1 truncate text-sm">{zone.name}</span>
            </div>
            {/* Kapılar */}
            <ul
              role="group"
              className={cn(
                "overflow-hidden transition-all duration-200 pl-8",
                isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              {zoneDoors.length === 0 ? (
                <li className="text-xs text-muted-foreground pl-2 pb-2">Kapı yok</li>
              ) : (
                zoneDoors.map((door) => (
                  <li key={door.id}>
                    <div
                      className={cn(
                        "flex items-center rounded-md px-2 py-1.5 ml-2 cursor-pointer text-sm",
                        "hover:bg-primary/10 hover:text-primary",
                        selectedDoor === door.id && "bg-primary/10 text-primary font-medium"
                      )}
                      onClick={() => {
                        setSelectedDoor(door.id);
                        onSelectDoor?.(door.id);
                      }}
                      style={{ paddingLeft: "16px" }}
                    >
                      <span className="ml-1">⎯ {door.name}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </li>
        );
      })}
    </ul>
  );
};
