import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { ChevronRight, Building2, Plus, Trash2, DoorClosed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddDoorDialog } from "./AddDoorDialog";
import { toast } from "@/hooks/use-toast";

interface ZoneDoorTreeProps {
  onSelectDoor?: (doorId: number | null) => void;
  onSelectZone?: (zoneId: number | null) => void;
  onZoneAdded?: () => void;
}

export const ZoneDoorTree = ({ onSelectDoor, onSelectZone, onZoneAdded }: ZoneDoorTreeProps) => {
  const zones = useQuery(api.zones.list, {}) ?? [];
  const doors = useQuery(api.doors.list, {}) ?? [];

  const removeZone = useMutation(api.zones.remove);
  const removeDoor = useMutation(api.doors.remove);

  const [selectedZone, setSelectedZone] = useState<Id<"zones"> | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<Id<"doors"> | null>(null);
  const [expandedZones, setExpandedZones] = useState<Id<"zones">[]>([]);
  const [showAddDoorDialog, setShowAddDoorDialog] = useState(false);
  const [selectedZoneForDoor, setSelectedZoneForDoor] = useState<{ id: Id<"zones">; name: string } | null>(null);

  const handleDeleteZone = async (zoneId: Id<"zones">) => {
    const zoneDoors = doors.filter((door: { zoneId?: Id<"zones"> }) => door.zoneId === zoneId);
    if (zoneDoors.length > 0) {
      toast({ title: "Hata", description: "Bu bölgede kapılar bulunuyor. Önce kapıları silmelisiniz.", variant: "destructive" });
      return;
    }
    try {
      await removeZone({ zoneId });
      toast({ title: "Başarılı", description: "Bölge silindi" });
      onZoneAdded?.();
    } catch {
      toast({ title: "Hata", description: "Bölge silinirken bir hata oluştu", variant: "destructive" });
    }
  };

  const handleDeleteDoor = async (doorId: Id<"doors">) => {
    try {
      await removeDoor({ doorId });
      toast({ title: "Başarılı", description: "Kapı silindi" });
    } catch {
      toast({ title: "Hata", description: "Kapı silinirken bir hata oluştu", variant: "destructive" });
    }
  };

  const handleAddDoor = (zoneId: Id<"zones">, zoneName: string) => {
    setSelectedZoneForDoor({ id: zoneId, name: zoneName });
    setShowAddDoorDialog(true);
  };

  return (
    <>
      <ul role="tree" className="space-y-0.5">
        {zones.map((zone: { _id: Id<"zones">; name: string }) => {
          const isExpanded = expandedZones.includes(zone._id);
          const zoneDoors = doors.filter((door: { zoneId?: Id<"zones"> }) => door.zoneId === zone._id);

          return (
            <li key={zone._id} role="treeitem" aria-expanded={isExpanded}>
              <div
                className={cn(
                  "group flex items-center gap-1 rounded-md p-2 transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedZone === zone._id && "bg-accent/80 text-accent-foreground font-medium"
                )}
                onClick={() => {
                  const next = zone._id === selectedZone ? null : zone._id;
                  setSelectedZone(next);
                  setSelectedDoor(null);
                  onSelectZone?.(next as unknown as number | null);
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 hover:bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedZones((prev) =>
                      prev.includes(zone._id) ? prev.filter((id) => id !== zone._id) : [...prev, zone._id]
                    );
                  }}
                >
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200", isExpanded && "rotate-90")} />
                </Button>

                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{zone.name}</span>

                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/80" onClick={(e) => { e.stopPropagation(); handleAddDoor(zone._id, zone.name); }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/80" onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone._id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <ul role="group" className={cn("overflow-hidden transition-all duration-200", isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0")}>
                {zoneDoors.length === 0 ? (
                  <li className="text-xs text-muted-foreground pl-8 py-2">Kapı yok</li>
                ) : (
                  zoneDoors.map((door: { _id: Id<"doors">; name: string }) => (
                    <li key={door._id}>
                      <div
                        className={cn(
                          "group flex items-center gap-1 rounded-md p-2 transition-all ml-6",
                          "hover:bg-accent hover:text-accent-foreground",
                          selectedDoor === door._id && "bg-accent/80 text-accent-foreground font-medium"
                        )}
                        onClick={() => {
                          const next = door._id === selectedDoor ? null : door._id;
                          setSelectedDoor(next);
                          onSelectDoor?.(next as unknown as number | null);
                        }}
                      >
                        <DoorClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-sm">{door.name}</span>
                        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/80" onClick={(e) => { e.stopPropagation(); handleDeleteDoor(door._id); }}>
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

      {selectedZoneForDoor && (
        <AddDoorDialog
          open={showAddDoorDialog}
          onOpenChange={setShowAddDoorDialog}
          onSuccess={() => {}}
          zoneId={selectedZoneForDoor.id as unknown as number}
          zoneName={selectedZoneForDoor.name}
        />
      )}
    </>
  );
};
