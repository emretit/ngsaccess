import type { Id } from "../../../convex/_generated/dataModel";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { ShiftCalendarPlan } from "./calendar/ShiftCalendarPlan";
import { useShiftCalendarDefinitions } from "./calendar/useShiftCalendarData";
export function ShiftCalendarView({
  projectId,
  projectName,
  openDefinitions,
}: {
  projectId: Id<"projects">;
  projectName: string;
  openDefinitions: (hasDefinitions: boolean) => void;
}) {
  const { employees, shifts } = useShiftCalendarDefinitions(projectId);
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
          employees={employees ?? []}
          shifts={shifts ?? []}
          definitionsLoading={employees === undefined || shifts === undefined}
          openDefinitions={() => openDefinitions((shifts?.length ?? 0) > 0)}
        />
      </QuerySectionBoundary>
    </div>
  );
}
