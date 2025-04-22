
import { useEffect, useState } from "react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ZoneDoorTreePanel() {
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
        <div className="flex items-center gap-2 text-primary">
          <Building2 className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{projectName}</h2>
        </div>
        <p className="text-sm text-muted-foreground">Bölgeler &amp; Kapılar</p>
      </div>
      <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <ZoneDoorTree />
      </div>
    </div>
  );
}
