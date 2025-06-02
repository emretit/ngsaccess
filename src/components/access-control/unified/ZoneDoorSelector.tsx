
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, MapPin, DoorOpen } from "lucide-react";

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

  const addSelection = (item: ZoneDoorSelection) => {
    const exists = value.some(v => v.type === item.type && v.id === item.id);
    if (!exists) {
      onChange([...value, item]);
    }
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeSelection = (item: ZoneDoorSelection) => {
    onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
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

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Bölge veya kapı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="pl-8 text-sm"
            disabled={disabled}
          />
        </div>

        {/* Dropdown */}
        {showDropdown && !disabled && (searchTerm || filteredZones.length > 0 || filteredDoors.length > 0) && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
            {/* Zones */}
            {filteredZones.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                  Bölgeler
                </div>
                {filteredZones.map((zone) => (
                  <button
                    key={`zone-${zone.id}`}
                    onClick={() => addSelection({ type: "zone", id: zone.id, name: zone.name })}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    disabled={value.some(v => v.type === "zone" && v.id === zone.id)}
                  >
                    <MapPin className="w-4 h-4 text-purple-500" />
                    {zone.name}
                  </button>
                ))}
              </div>
            )}

            {/* Doors */}
            {filteredDoors.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                  Kapılar
                </div>
                {filteredDoors.map((door) => (
                  <button
                    key={`door-${door.id}`}
                    onClick={() => addSelection({ type: "door", id: door.id, name: door.name })}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    disabled={value.some(v => v.type === "door" && v.id === door.id)}
                  >
                    <DoorOpen className="w-4 h-4 text-orange-500" />
                    {door.name}
                  </button>
                ))}
              </div>
            )}

            {searchTerm && filteredZones.length === 0 && filteredDoors.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                Sonuç bulunamadı
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneDoorSelector;
