import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Building2, Plus } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { AddZoneDialog } from "./AddZoneDialog";
import { Button } from "@/components/ui/button";
import { useProjectAccess } from "@/hooks/useProjectAccess";

interface ZoneDoorTreePanelProps {
  onSelectZone?: (zoneId: number | null) => void;
  onSelectDoor?: (doorId: number | null) => void;
}

export function ZoneDoorTreePanel({ onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
  const { isSuperAdmin } = useProjectAccess();
  const [showAddZoneDialog, setShowAddZoneDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const generalSettings = useQuery(api.settings.getGeneral);
  const companyName = isSuperAdmin ? "Tüm Projeler" : (generalSettings?.companyName ?? "Ana Proje");

  const handleZoneAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleProjectHeaderClick = () => {
    onSelectZone?.(null);
    onSelectDoor?.(null);
  };

  return (
    <>
      <div className="h-full w-[280px] shrink-0 bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b border-border">
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
                setShowAddZoneDialog(true);
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
