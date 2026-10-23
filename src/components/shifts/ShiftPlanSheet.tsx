import { DepartmentAssignments } from "./DepartmentAssignments";
import { useSearchParams } from "react-router-dom";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ShiftCalendarView } from "./ShiftCalendarView";

export function useShiftPlanOpen() {
  const [params, setParams] = useSearchParams();
  return {
    open: params.get("plan") === "1",
    setOpen: (open: boolean) => setParams(previous => {
      const next = new URLSearchParams(previous);
      if (open) next.set("plan", "1");
      else next.delete("plan");
      return next;
    }),
  };
}
/** Proje yüklenirken ya da seçili değilken de açılır; ?plan=1 (eski /shifts yönlendirmesi) URL'de takılı kalmaz. */
export function ShiftPlanSheet({ onCreateShift }: { onCreateShift: () => void }) {
  const { open, setOpen } = useShiftPlanOpen();
  const { projectId, activeProject, loading } = useActiveProjectScope();
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-[min(1400px,96vw)]">
      <SheetHeader>
        <SheetTitle>Vardiya planı</SheetTitle>
        <SheetDescription>Çalışanların vardiya atamalarını takvimde inceleyin.</SheetDescription>
      </SheetHeader>
      <div className="mt-6">{loading ? <SectionSkeleton label="Proje yükleniyor" />
        : !projectId ? <EmptyState title="Proje seçin" description="Vardiya planını görmek için aktif bir proje seçin." />
        : <QuerySectionBoundary resetKey={projectId} title="Vardiya verileri yüklenemedi">
          <ShiftCalendarView key={projectId} projectId={projectId} projectName={activeProject?.name ?? "Seçili proje"}
            openDefinitions={(hasDefinitions) => { setOpen(false); if (!hasDefinitions) onCreateShift(); }} />
          <DepartmentAssignments projectId={projectId} />
        </QuerySectionBoundary>}
      </div>
    </SheetContent>
  </Sheet>;
}
