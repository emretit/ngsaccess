
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { AddZoneDialog } from "./AddZoneDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useProjectAccess } from "@/hooks/useProjectAccess";

interface ZoneDoorTreePanelProps {
  onSelectZone?: (zoneId: number | null) => void;
  onSelectDoor?: (doorId: number | null) => void;
}

export function ZoneDoorTreePanel({ onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
  const { projectIds, isSuperAdmin } = useProjectAccess();
  const [companyName, setCompanyName] = useState("Ana Proje");
  const [showAddZoneDialog, setShowAddZoneDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchCompanyName();
  }, [projectIds, isSuperAdmin]);

  const fetchCompanyName = async () => {
    try {
      if (isSuperAdmin) {
        setCompanyName("Tüm Projeler");
        return;
      }

      // Fetch company name from general_settings instead of companies table
      const { data: settings, error } = await supabase
        .from("general_settings")
        .select("company_name")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching company name:", error);
        setCompanyName("Şirket");
        return;
      }

      if (settings && settings.company_name) {
        setCompanyName(settings.company_name);
      } else {
        setCompanyName("Şirket Bulunamadı");
      }
    } catch (error) {
      console.error("Error in fetchCompanyName:", error);
      setCompanyName("Ana Proje");
    }
  };

  const handleAddZone = () => {
    setShowAddZoneDialog(true);
  };

  const handleZoneAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleProjectHeaderClick = () => {
    // Tüm filtreleri sıfırla
    if (onSelectZone) onSelectZone(null);
    if (onSelectDoor) onSelectDoor(null);
  };

  return (
    <>
      <div className="h-full w-[280px] bg-card rounded-lg border shadow">
        <div className="p-6 border-b border-gray-100">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors"
            onClick={handleProjectHeaderClick}
          >
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-primary flex-1">{companyName}</h2>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleAddZone();
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">Bölgeler & Kapılar</p>
        </div>
        <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
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
