
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ChevronsUpDown, CircleAlert } from "lucide-react";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { cn } from "@/lib/utils";

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

  const handleRemoveItem = (item: ZoneDoorSelection) => {
    onChange(value.filter((i) => !(i.type === item.type && i.id === item.id)));
  };

  const isSelected = (type: "zone" | "door", id: number) => {
    return value.some((item) => item.type === type && item.id === id);
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full text-sm font-normal h-auto py-2 pr-2"
          >
            <span className={value.length === 0 ? "text-muted-foreground" : ""}>
              {value.length === 0
                ? "Bölge veya kapı seçin..."
                : `${value.length} öğe seçildi`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command className="w-full">
            <CommandInput 
              placeholder="Bölge veya kapı ara..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Yükleniyor...
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm text-destructive flex items-center justify-center gap-2">
                  <CircleAlert className="h-4 w-4" />
                  <span>Veriler yüklenirken hata oluştu</span>
                </div>
              ) : (
                <>
                  <CommandGroup heading="Bölgeler">
                    {zones
                      .filter(zone => 
                        zone.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((zone) => (
                        <CommandItem
                          key={`zone-${zone.id}`}
                          value={`zone-${zone.id}-${zone.name}`}
                          onSelect={() => {
                            handleToggleItem({
                              type: "zone",
                              id: zone.id,
                              name: zone.name,
                            });
                          }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <span>{zone.name}</span>
                          </div>
                          <div className={cn(
                            "h-4 w-4 rounded-sm border border-primary",
                            isSelected("zone", zone.id)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}/>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Kapılar">
                    {doors
                      .filter(door => 
                        door.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((door) => (
                        <CommandItem
                          key={`door-${door.id}`}
                          value={`door-${door.id}-${door.name}`}
                          onSelect={() => {
                            handleToggleItem({
                              type: "door",
                              id: door.id,
                              name: door.name,
                            });
                          }}
                          className="flex items-center justify-between"
                        >
                          <span>{door.name}</span>
                          <div className={cn(
                            "h-4 w-4 rounded-sm border border-primary",
                            isSelected("door", door.id)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}/>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
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
