
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Command,
  CommandEmpty, 
  CommandGroup,
  CommandInput, 
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { X, ChevronsUpDown, Grid } from "lucide-react";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { cn } from "@/lib/utils";
import { Zone, Door } from "@/types/access-control";

interface ZoneDoorSelection {
  type: "zone" | "door";
  id: number;
  name: string;
}

interface ZoneDoorSelectorProps {
  value: ZoneDoorSelection[];
  onChange: (value: ZoneDoorSelection[]) => void;
}

export default function ZoneDoorSelector({ value, onChange }: ZoneDoorSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { zones, doors, loading, error } = useZonesAndDoors();
  const [expandedZones, setExpandedZones] = useState<number[]>([]);
  
  // Toggle zone expansion in the tree view
  const toggleZoneExpansion = (zoneId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setExpandedZones(prev => 
      prev.includes(zoneId) 
        ? prev.filter(id => id !== zoneId)
        : [...prev, zoneId]
    );
  };
  
  // Check if an item is selected
  const isSelected = (type: "zone" | "door", id: number) => {
    return value.some((item) => item.type === type && item.id === id);
  };

  // Handle item selection
  const handleToggleItem = (item: ZoneDoorSelection) => {
    const exists = value.some(
      (i) => i.type === item.type && i.id === item.id
    );

    if (exists) {
      onChange(value.filter((i) => !(i.type === item.type && i.id === item.id)));
    } else {
      onChange([...value, item]);
    }
  };

  // Handle item removal
  const handleRemoveItem = (item: ZoneDoorSelection) => {
    onChange(value.filter((i) => !(i.type === item.type && i.id === item.id)));
  };

  // Group doors by zone for the tree view
  const doorsByZone: Record<number, Door[]> = {};
  doors.forEach(door => {
    if (door.zone_id) {
      if (!doorsByZone[door.zone_id]) {
        doorsByZone[door.zone_id] = [];
      }
      doorsByZone[door.zone_id].push(door);
    }
  });

  // Render tree structure
  function renderTree(nodes: Zone[]) {
    return nodes.map(zone => (
      <div key={`zone-${zone.id}`}>
        <div className="flex items-center gap-2 py-1.5 font-semibold text-sm">
          <Checkbox
            checked={isSelected("zone", zone.id)}
            onCheckedChange={() => {
              handleToggleItem({
                type: "zone",
                id: zone.id,
                name: zone.name,
              });
            }}
            id={`zone-checkbox-${zone.id}`}
          />
          <label htmlFor={`zone-checkbox-${zone.id}`} className="cursor-pointer select-none">
            {zone.name}
          </label>
        </div>
        <div className="pl-6">
          {doorsByZone[zone.id]?.map((door) => (
            <div key={`door-${door.id}`} className="flex items-center gap-2 py-0.5">
              <div className="border-l h-full mr-2" style={{ minHeight: "14px" }} />
              <Checkbox
                checked={isSelected("door", door.id)}
                onCheckedChange={() => {
                  handleToggleItem({
                    type: "door",
                    id: door.id,
                    name: door.name,
                  });
                }}
                id={`door-checkbox-${door.id}`}
              />
              <label htmlFor={`door-checkbox-${door.id}`} className="cursor-pointer select-none text-xs">
                {door.name}
              </label>
            </div>
          ))}
        </div>
      </div>
    ));
  }

  // Render unassigned doors (without a zone)
  const unassignedDoors = doors.filter(door => !door.zone_id);
  
  return (
    <div className="bg-white rounded-lg shadow p-3 max-w-xs max-h-[300px] overflow-y-auto text-xs">
      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Yükleniyor...
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-destructive">
          Veriler yüklenirken hata oluştu
        </div>
      ) : (
        <>
          {renderTree(zones)}
          
          {/* Unassigned doors section */}
          {unassignedDoors.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-muted-foreground pt-2 border-t">
                Atanmamış Kapılar
              </div>
              {unassignedDoors.map((door) => (
                <div key={`door-${door.id}`} className="flex items-center gap-2 py-0.5 mt-1">
                  <Checkbox
                    checked={isSelected("door", door.id)}
                    onCheckedChange={() => {
                      handleToggleItem({
                        type: "door",
                        id: door.id,
                        name: door.name,
                      });
                    }}
                    id={`door-checkbox-${door.id}`}
                  />
                  <label htmlFor={`door-checkbox-${door.id}`} className="cursor-pointer select-none text-xs">
                    {door.name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      
      {/* Selected items display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t">
          {value.map((item) => (
            <Badge
              key={`${item.type}-${item.id}`}
              variant="secondary"
              className="text-xs py-1 pl-2 pr-1 flex items-center gap-1"
            >
              <span>{item.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-3 w-3 p-0 text-muted-foreground hover:text-foreground rounded-full"
                onClick={() => handleRemoveItem(item)}
              >
                <X className="h-2 w-2" />
                <span className="sr-only">Kaldır</span>
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
