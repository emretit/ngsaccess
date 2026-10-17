import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Building2, Plus } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { AddZoneDialog } from "./AddZoneDialog";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface ZoneDoorTreePanelProps {
  selectedZoneId: string | null;
  selectedDoorId: string | null;
  onSelectZone?: (zoneId: string | null) => void;
  onSelectDoor?: (doorId: string | null) => void;
}

export function ZoneDoorTreePanel({ selectedZoneId, selectedDoorId, onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
  const { activeProject, isSuperAdmin, projectId, loading: projectLoading } = useActiveProject();
  const [showAddZoneDialog, setShowAddZoneDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const generalSettings = useQuery(
    api.settings.getGeneral,
    !projectLoading && projectId ? { projectId } : "skip",
  );
  const companyName = isSuperAdmin
    ? (activeProject?.name ?? "Proje seç")
    : (generalSettings?.companyName ?? activeProject?.name ?? "Ana Proje");

  const handleZoneAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleProjectHeaderClick = () => {
    onSelectZone?.(null);

  };

  return (
    <>
      <div className="w-full min-w-0 lg:w-[300px] shrink-0 bg-card rounded-xl border shadow-xs">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleProjectHeaderClick} className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${companyName}: bölge ve kapı filtrelerini temizle`}>
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-base font-semibold text-primary break-words">{companyName}</span>
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label="Bölge ekle"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddZoneDialog(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Bölgeler & Kapılar</p>
        </div>
        <div className="p-2 max-h-72 lg:max-h-[calc(100vh-12rem)] overflow-y-auto">
          <ZoneDoorTree
            key={`${projectId}-${refreshKey}`}
            selectedZoneId={selectedZoneId}
            selectedDoorId={selectedDoorId}
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
