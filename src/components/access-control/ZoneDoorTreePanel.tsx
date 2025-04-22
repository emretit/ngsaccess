
import { useEffect, useState } from "react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ZoneDoorTreePanel() {
  const [projectName, setProjectName] = useState("Ana Proje");
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<number | null>(null);

  useEffect(() => {
    async function fetchProjectName() {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data?.name) setProjectName(data.name);
    }
    fetchProjectName();
  }, []);

  const handleHeaderClick = () => {
    setSelectedZone(null);
    setSelectedDoor(null);
  };

  return (
    <div className="h-full w-[280px] bg-card rounded-lg border shadow">
      <div className="p-4 border-b space-y-1.5">
        <div
          className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors"
          onClick={handleHeaderClick}
        >
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">{projectName}</h2>
        </div>
        <p className="text-sm text-muted-foreground">Bölgeler &amp; Kapılar</p>
      </div>

      <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <ul role="tree" className="space-y-0.5">
          <ZoneDoorTree
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
            selectedDoor={selectedDoor}
            onSelectDoor={setSelectedDoor}
          />
        </ul>
      </div>
    </div>
  );
}
