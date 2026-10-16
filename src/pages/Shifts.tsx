import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useToast } from "@/hooks/use-toast";
import { ShiftCalendarView } from "@/components/shifts/ShiftCalendarView";
import { ShiftListSidebar } from "@/components/shifts/ShiftListSidebar";
import {
  AddShiftDialog,
  type ShiftFormPayload,
} from "@/components/settings/sections/components/AddShiftDialog";

export default function Shifts() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();
  const [firstShiftOpen, setFirstShiftOpen] = useState(false);
  const createShift = useMutation(api.shifts.create);
  const updateShift = useMutation(api.shifts.update);

  const employees = useQuery(api.employees.list, projectLoading ? "skip" : {});
  const shifts = useQuery(api.shifts.list, projectLoading ? "skip" : {});
  const assignments = useQuery(
    api.shifts.listAssignments,
    projectLoading ? "skip" : {},
  );

  if (projectLoading || shifts === undefined) {
    return <SectionSkeleton label="Vardiya verileri yükleniyor..." />;
  }

  const isLoading = employees === undefined || assignments === undefined;

  const handleCreateFirstShift = async (payload: ShiftFormPayload) => {
    if (!projectId) throw new Error("Vardiya eklemek için proje seçin");
    await createShift({ projectId, ...payload });
    toast({ title: "Vardiya oluşturuldu" });
  };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 min-h-full">
        <ShiftListSidebar
          shifts={shifts}
          assignments={assignments ?? []}
          projectId={projectId ?? undefined}
        />

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <SectionSkeleton label="Yükleniyor..." />
          ) : (
            <ShiftCalendarView
              employees={employees ?? []}
              shifts={shifts}
              assignments={assignments ?? []}
              onNavigateToDefinitions={() => setFirstShiftOpen(true)}
            />
          )}
        </div>
      </div>

      <AddShiftDialog
        open={firstShiftOpen}
        onOpenChange={setFirstShiftOpen}
        onAdd={handleCreateFirstShift}
        onUpdate={async (id, payload) => {
          await updateShift({ shiftId: id, ...payload });
        }}
        editingShift={null}
        onClose={() => setFirstShiftOpen(false)}
      />
    </>
  );
}
