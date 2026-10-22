import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import { ShiftListSidebar } from "./ShiftListSidebar";
import { ShiftCalendarPlan } from "./calendar/ShiftCalendarPlan";
import { useShiftCalendarDefinitions } from "./calendar/useShiftCalendarData";
export function ShiftCalendarView({
  projectId,
  projectName,
}: {
  projectId: Id<"projects">;
  projectName: string;
}) {
  const { employees, shifts } = useShiftCalendarDefinitions(projectId);
  const [definitions, setDefinitions] = useState(false);
  if (!employees || !shifts)
    return <SectionSkeleton label="Çalışanlar ve vardiyalar yükleniyor" />;
  return (
    <div className="group/plan min-w-0 max-w-full space-y-5">
      <QuerySectionBoundary
        resetKey={projectId}
        title="Vardiya planı yüklenemedi"
        description="Tekrar deneyin. Vardiya tanımlarını görüntülemeye devam edebilirsiniz."
      >
        <ShiftCalendarPlan
          projectId={projectId}
          projectName={projectName}
          employees={employees}
          shifts={shifts}
          openDefinitions={() => setDefinitions(true)}
        />
      </QuerySectionBoundary>
      <Button
        variant="outline"
        className="hidden group-has-[[role=alert]]/plan:inline-flex"
        onClick={() => setDefinitions(true)}
      >
        Vardiya tanımları
      </Button>
      <QuerySectionBoundary resetKey={projectId} title="Vardiya tanımları yüklenemedi">
        <ShiftListSidebar
          open={definitions}
          onOpenChange={setDefinitions}
          shifts={shifts}
          projectId={projectId}
        />
      </QuerySectionBoundary>
    </div>
  );
}
