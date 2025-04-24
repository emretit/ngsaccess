
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";

interface ZoneDoorTreePanelProps {
  onSelectZone?: (zoneId: number | null) => void;
  onSelectDoor?: (doorId: number | null) => void;
}

export function ZoneDoorTreePanel({ onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
  const [projectName, setProjectName] = useState("Ana Proje");

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

  return (
    <div className="h-full w-[280px] bg-card rounded-lg border shadow">
      <div className="p-4 border-b space-y-1.5">
        <div className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">{projectName}</h2>
        </div>
        <p className="text-sm text-muted-foreground">Bölgeler &amp; Kapılar</p>
      </div>
      <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <ZoneDoorTree 
          onSelectZone={onSelectZone}
          onSelectDoor={onSelectDoor}
        />
      </div>
    </div>
  );
}
