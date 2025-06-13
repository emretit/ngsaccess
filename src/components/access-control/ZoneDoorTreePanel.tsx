
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

      if (projectIds.length > 0) {
        // İlk şirket bilgisini al
        const { data: company, error } = await supabase
          .from("companies")
          .select("name")
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching company name:", error);
          setCompanyName("Şirket");
          return;
        }

        if (company) {
          setCompanyName(company.name);
        } else {
          setCompanyName("Şirket");
        }
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

  return (
    <>
      <div className="h-full w-[280px] bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{companyName}</h2>
                <p className="text-xs text-gray-500">Bölgeler & Kapılar</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-gray-100"
              onClick={handleAddZone}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="p-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
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
