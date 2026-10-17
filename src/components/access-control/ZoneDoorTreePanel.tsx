import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Building2, Plus } from "lucide-react";
import { ZoneDoorTree } from "./ZoneDoorTree";
import { AddZoneDialog } from "./AddZoneDialog";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface ZoneDoorTreePanelProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  selectedZoneId: string | null;
  selectedDoorId: string | null;
  onSelectZone?: (zoneId: string | null) => void;
  onSelectDoor?: (doorId: string | null) => void;
}

export function ZoneDoorTreePanel({ open = true, onOpenChange, selectedZoneId, selectedDoorId, onSelectZone, onSelectDoor }: ZoneDoorTreePanelProps) {
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
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="full" className="w-full sm:max-w-[480px] min-w-0 overflow-y-auto p-0">
        <SheetHeader className="border-b border-line p-5 pr-12 text-left"><SheetTitle>Bölge ve kapı</SheetTitle><SheetDescription>Konum seçerek cihaz listesini filtreleyin.</SheetDescription></SheetHeader>
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleProjectHeaderClick} className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${companyName}: bölge ve kapı filtrelerini temizle`}>
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 text-sm font-semibold break-all">{companyName}</span>
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
          <p className="text-xs text-muted-foreground mt-1">Bölgeler ve kapılar</p>
        </div>
        <div className="min-w-0 p-3">
          <ZoneDoorTree
            key={`${projectId}-${refreshKey}`}
            selectedZoneId={selectedZoneId}
            selectedDoorId={selectedDoorId}
            onSelectZone={onSelectZone}
            onSelectDoor={onSelectDoor}
            onZoneAdded={handleZoneAdded}
          />
        </div>
      </SheetContent>
      </Sheet>

      <AddZoneDialog
        open={showAddZoneDialog}
        onOpenChange={setShowAddZoneDialog}
        onSuccess={handleZoneAdded}
      />
    </>
  );
}
