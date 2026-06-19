import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Building2, Plus } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { AddZoneDialog } from "./AddZoneDialog";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface ZoneDoorTreePanelProps {
  onSelectZone?: (zoneId: string | null) => void;
  onSelectDoor?: (doorId: string | null) => void;
}

export function ZoneDoorTreePanel({ onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
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
    onSelectDoor?.(null);
  };

  return (
    <>
      <div className="h-full w-full md:w-[240px] shrink-0 bg-card rounded-xl border shadow-xs">
        <div className="p-4 border-b border-border">
          <div
            className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors"
            onClick={handleProjectHeaderClick}
          >
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-primary flex-1">{companyName}</h2>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
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
