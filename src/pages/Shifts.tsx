import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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

  const employees = useQuery(api.employees.list, projectLoading ? "skip" : {});
  const shifts = useQuery(api.shifts.list, projectLoading ? "skip" : {});
  const assignments = useQuery(
    api.shifts.listAssignments,
    projectLoading ? "skip" : {},
  );

  const overlayRange = (() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 60);
    const end = new Date(today);
    end.setDate(end.getDate() + 180);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  })();
  const leaves = useQuery(
    api.leaves.listForRange,
    projectLoading ? "skip" : overlayRange,
  );
  const holidays = useQuery(
    api.holidays.listForRange,
    projectLoading ? "skip" : overlayRange,
  );

  if (projectLoading || shifts === undefined) {
    return <LoadingSpinner text="Vardiya verileri yükleniyor..." />;
  }

  const isLoading = employees === undefined || assignments === undefined;

  const handleCreateFirstShift = async (payload: ShiftFormPayload) => {
    if (!projectId) {
      toast({
        title: "Proje bulunamadı",
        description: "Vardiya eklemek için en az bir projeye atanmış olmalısınız.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createShift({ projectId, ...payload });
      toast({
        title: "Vardiya oluşturuldu",
        description: `"${payload.name}" eklendi. Artık atama yapabilirsiniz.`,
      });
      setFirstShiftOpen(false);
    } catch (e) {
      toast({
        title: "Vardiya eklenemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
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
            <LoadingSpinner text="Yükleniyor..." />
          ) : (
            <ShiftCalendarView
              employees={employees ?? []}
              shifts={shifts}
              assignments={assignments ?? []}
              leaves={leaves ?? []}
              holidays={holidays ?? []}
              onNavigateToDefinitions={() => setFirstShiftOpen(true)}
            />
          )}
        </div>
      </div>

      <AddShiftDialog
        open={firstShiftOpen}
        onOpenChange={setFirstShiftOpen}
        onAdd={handleCreateFirstShift}
        onUpdate={async () => {}}
        editingShift={null}
        onClose={() => setFirstShiftOpen(false)}
      />
    </>
  );
}
