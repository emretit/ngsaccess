import { useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronDown, Settings } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { PDKS_SETTINGS_FROM_SHIFT_PLAN, PDKS_SETTINGS_PATH } from "@/components/pdks/settings/route";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { PageTemplate } from "@/components/shared/PageTemplate";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import type { Id } from "../../convex/_generated/dataModel";
import { DepartmentAssignments } from "@/components/shifts/DepartmentAssignments";
import { ShiftCalendarView } from "@/components/shifts/ShiftCalendarView";
import { ShiftTree } from "@/components/shifts/ShiftTree";

export default function ShiftPlan() {
  const { projectId, activeProject, loading } = useActiveProjectScope();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const selectedShiftId = (params.get("shift") ?? undefined) as Id<"shifts"> | undefined;
  const selectShift = (shiftId: Id<"shifts"> | undefined) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (shiftId) next.set("shift", shiftId);
    else next.delete("shift");
    return next;
  }, { replace: true, state: location.state });
  const openDefinitions = (hasDefinitions: boolean) => {
    if (!hasDefinitions) {
      setCreateOpen(true);
      return;
    }
    const toggle = sidebarRef.current?.querySelector<HTMLButtonElement>('button[aria-controls="pdks-shifts"]');
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    toggle?.focus();
    sidebarRef.current?.scrollIntoView({ block: "nearest" });
  };
  const back = () => {
    const state: unknown = location.state;
    if (typeof state === "object" && state !== null && "fromRecords" in state && state.fromRecords === true) navigate(-1);
    else navigate("/pdks-records");
  };
  return <PageTemplate
    title="Vardiya planı"
    scope={activeProject?.name ?? "Proje seçin"}
    backLink={<Button variant="ghost" size="sm" className="-ml-2 min-h-11" aria-label="PDKS sayfasına dön" onClick={back}>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />PDKS
    </Button>}
    secondaryActions={can("schedule.manage") && <Button variant="outline" className="max-sm:min-h-11" asChild>
      <Link to={PDKS_SETTINGS_PATH} state={PDKS_SETTINGS_FROM_SHIFT_PLAN}>
        <Settings className="h-4 w-4" aria-hidden="true" />Ayarlar
      </Link>
    </Button>}
    primaryAction={<div ref={setActionsContainer} className="flex flex-wrap items-center gap-2 [&_button]:max-sm:min-h-11 [&_a]:max-sm:min-h-11" />}
    aside={!loading && projectId ? { label: "Vardiyalar", content:
      <QuerySectionBoundary resetKey={projectId} title="Vardiyalar yüklenemedi" className="w-full min-w-0 shrink-0 min-[1100px]:w-[220px]">
        <div ref={sidebarRef}>
          <ShiftTree key={projectId} projectId={projectId} selectedShiftId={selectedShiftId} onSelectShift={selectShift}
            createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
        </div>
      </QuerySectionBoundary>
    } : undefined}
  >
    {loading ? <SectionSkeleton label="Proje yükleniyor" />
      : !projectId ? <EmptyState title="Proje seçin" description="Vardiya planını görmek için aktif bir proje seçin." />
      : <QuerySectionBoundary resetKey={projectId} title="Vardiya verileri yüklenemedi">
        <div className="min-w-0 space-y-6">
          <ShiftCalendarView key={projectId} projectId={projectId} projectName={activeProject?.name ?? "Seçili proje"}
            shiftFilter={selectedShiftId ?? "all"} onShiftFilterChange={value => selectShift(value === "all" ? undefined : value as Id<"shifts">)}
            openDefinitions={openDefinitions} actionsContainer={actionsContainer} />
          <details className="group rounded-lg border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Departman atamaları
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-4"><DepartmentAssignments key={projectId} projectId={projectId} /></div>
          </details>
        </div>
      </QuerySectionBoundary>}
  </PageTemplate>;
}
