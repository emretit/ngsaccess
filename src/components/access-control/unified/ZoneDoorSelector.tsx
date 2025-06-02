
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, MapPin, DoorOpen, ChevronDown } from "lucide-react";

interface ZoneDoorSelection {
  type: "zone" | "door";
  id: number;
  name: string;
}

interface ZoneDoorSelectorProps {
  value: ZoneDoorSelection[];
  onChange: (selection: ZoneDoorSelection[]) => void;
  disabled?: boolean;
}

const ZoneDoorSelector = ({ 
  value, 
  onChange, 
  disabled = false 
}: ZoneDoorSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch zones
  const { data: zones = [] } = useQuery({
    queryKey: ['zones-selector'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch doors
  const { data: doors = [] } = useQuery({
    queryKey: ['doors-selector'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doors')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Filter items based on search term
  const filteredZones = zones.filter(zone => 
    zone.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDoors = doors.filter(door => 
    door.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSelected = (item: ZoneDoorSelection) => {
    return value.some(v => v.type === item.type && v.id === item.id);
  };

  const toggleSelection = (item: ZoneDoorSelection) => {
    const exists = value.some(v => v.type === item.type && v.id === item.id);
    if (exists) {
      onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
    } else {
      onChange([...value, item]);
    }
  };

  const removeSelection = (item: ZoneDoorSelection) => {
    onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
  };

  const selectAllZones = () => {
    const allZones = filteredZones.map(zone => ({
      type: "zone" as const,
      id: zone.id,
      name: zone.name
    }));
    const newSelections = allZones.filter(zone => !isSelected(zone));
    onChange([...value, ...newSelections]);
  };

  const selectAllDoors = () => {
    const allDoors = filteredDoors.map(door => ({
      type: "door" as const,
      id: door.id,
      name: door.name
    }));
    const newSelections = allDoors.filter(door => !isSelected(door));
    onChange([...value, ...newSelections]);
  };

  return (
    <div className="space-y-2">
      {/* Selected items */}
      <div className="flex flex-wrap gap-1 min-h-[2rem]">
        {value.map((item) => (
          <Badge
            key={`${item.type}-${item.id}`}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {item.type === "zone" ? <MapPin className="w-3 h-3" /> : <DoorOpen className="w-3 h-3" />}
            <span className="text-xs">{item.name}</span>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeSelection(item)}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </Badge>
        ))}
      </div>

      {/* Dropdown trigger */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled}
        >
          <span className="text-sm text-muted-foreground">
            Bölge veya kapı seçin...
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* Dropdown content */}
        {showDropdown && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-hidden">
            {/* Search input */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-auto">
              {/* Zones section */}
              {filteredZones.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b flex justify-between items-center">
                    <span>Bölgeler</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={selectAllZones}
                    >
                      Tümünü Seç
                    </Button>
                  </div>
                  {filteredZones.map((zone) => {
                    const item = { type: "zone" as const, id: zone.id, name: zone.name };
                    return (
                      <div
                        key={`zone-${zone.id}`}
                        className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSelection(item)}
                      >
                        <Checkbox
                          checked={isSelected(item)}
                          onChange={() => {}}
                        />
                        <MapPin className="w-4 h-4 text-purple-500" />
                        <span className="text-sm">{zone.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Doors section */}
              {filteredDoors.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b flex justify-between items-center">
                    <span>Kapılar</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={selectAllDoors}
                    >
                      Tümünü Seç
                    </Button>
                  </div>
                  {filteredDoors.map((door) => {
                    const item = { type: "door" as const, id: door.id, name: door.name };
                    return (
                      <div
                        key={`door-${door.id}`}
                        className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSelection(item)}
                      >
                        <Checkbox
                          checked={isSelected(item)}
                          onChange={() => {}}
                        />
                        <DoorOpen className="w-4 h-4 text-orange-500" />
                        <span className="text-sm">{door.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchTerm && filteredZones.length === 0 && filteredDoors.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Sonuç bulunamadı
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="p-2 border-t bg-gray-50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowDropdown(false)}
              >
                Kapat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneDoorSelector;
