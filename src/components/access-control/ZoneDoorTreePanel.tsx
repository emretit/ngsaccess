
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { AddZoneDialog } from "./AddZoneDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ZoneDoorTreePanelProps {
  onSelectZone?: (zoneId: number | null) => void;
  onSelectDoor?: (doorId: number | null) => void;
}

export function ZoneDoorTreePanel({ onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
  const [projectName, setProjectName] = useState("Ana Proje");
  const [showAddZoneDialog, setShowAddZoneDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchProjectName() {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("is_active", true)
        .single();

      if (!error && data?.name) setProjectName(data.name);
    }
    fetchProjectName();
  }, []);

  const handleAddZone = () => {
    setShowAddZoneDialog(true);
  };

  const handleZoneAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      <div className="h-full w-[320px] bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{projectName}</h2>
                <p className="text-sm text-gray-500">Bölgeler & Kapılar</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={handleAddZone}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
          <ZoneDoorTree 
            key={refreshKey}
            onSelectZone={onSelectZone}
            onSelectDoor={onSelectDoor}
            onZoneAdded={handleZoneAdded}
          />
        </div>
      </div>

      <AddZoneDialog
        open={showAddZoneDialog}
        onOpenChange={setShowAddZoneDialog}
        onSuccess={handleZoneAdded}
      />
    </>
  );
}
