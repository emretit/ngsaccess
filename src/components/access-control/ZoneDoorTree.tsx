
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Grid, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

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
  onSelectDoor?: (doorId: number | null) => void;
  onSelectZone?: (zoneId: number | null) => void;
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

  const handleDeleteZone = async (zoneId: number) => {
    const zoneDoors = doors.filter(door => door.zone_id === zoneId);
    if (zoneDoors.length > 0) {
      toast({
        title: "Hata",
        description: "Bu bölgede kapılar bulunuyor. Önce kapıları silmelisiniz.",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("zones")
      .delete()
      .eq("id", zoneId);

    if (error) {
      toast({
        title: "Hata",
        description: "Bölge silinirken bir hata oluştu",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Başarılı",
      description: "Bölge silindi",
    });
    fetchZonesAndDoors();
  };

  const handleDeleteDoor = async (doorId: number) => {
    const { error } = await supabase
      .from("doors")
      .delete()
      .eq("id", doorId);

    if (error) {
      toast({
        title: "Hata",
        description: "Kapı silinirken bir hata oluştu",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Başarılı",
      description: "Kapı silindi",
    });
    fetchZonesAndDoors();
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
                "group flex items-center gap-1 rounded-md p-2 transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                selectedZone === zone.id && "bg-accent/80 text-accent-foreground font-medium"
              )}
              onClick={() => {
                setSelectedZone(zone.id === selectedZone ? null : zone.id);
                setSelectedDoor(null);
                onSelectZone?.(zone.id === selectedZone ? null : zone.id);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedZones(prev =>
                    prev.includes(zone.id)
                      ? prev.filter(id => id !== zone.id)
                      : [...prev, zone.id]
                  );
                }}
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200",
                    isExpanded && "rotate-90"
                  )}
                />
              </Button>

              <Grid className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{zone.name}</span>

              <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-accent/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Implement add door functionality
                    toast({
                      title: "Bilgi",
                      description: "Kapı ekleme özelliği yakında eklenecek",
                    });
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-accent/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteZone(zone.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Doors list */}
            <ul
              role="group"
              className={cn(
                "overflow-hidden transition-all duration-200",
                isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              {zoneDoors.length === 0 ? (
                <li className="text-xs text-muted-foreground pl-8 py-2">Kapı yok</li>
              ) : (
                zoneDoors.map((door) => (
                  <li key={door.id}>
                    <div
                      className={cn(
                        "group flex items-center gap-1 rounded-md p-2 transition-all ml-6",
                        "hover:bg-accent hover:text-accent-foreground",
                        selectedDoor === door.id && "bg-accent/80 text-accent-foreground font-medium"
                      )}
                      onClick={() => {
                        setSelectedDoor(door.id);
                        onSelectDoor?.(door.id);
                      }}
                    >
                      <Grid className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{door.name}</span>

                      <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-accent/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoor(door.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
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
}
