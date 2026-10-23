import type { Id } from "../../../convex/_generated/dataModel";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
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
          openDefinitions={() => openDefinitions(shifts.length > 0)}
        />
      </QuerySectionBoundary>
    </div>
  );
}
