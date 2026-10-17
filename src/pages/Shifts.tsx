import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { ShiftCalendarView } from "@/components/shifts/ShiftCalendarView";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
export default function Shifts() {
  const { projectId, activeProject, loading } = useActiveProjectScope();
  if (loading) return <SectionSkeleton label="Proje yükleniyor" />;
  if (!projectId)
    return (
      <EmptyState
        title="Proje seçin"
        description="Vardiya planını görmek için aktif bir proje seçin."
      />
    );
  return (
    <QuerySectionBoundary
      resetKey={projectId}
      title="Vardiya verileri yüklenemedi"
    >
      <ShiftCalendarView
        key={projectId}
        projectId={projectId}
        projectName={activeProject?.name ?? "Seçili proje"}
      />
    </QuerySectionBoundary>
  );
}
