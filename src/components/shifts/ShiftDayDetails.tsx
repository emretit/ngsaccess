import { shortDate, shiftTimeLabel } from "./lib/planning";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShiftCalendarCell } from "./ShiftCalendarCell";
import {
  DAYS,
  dayLabel,
  type Assignment,
  type DayData,
  type Employee,
} from "./lib/planning";
export function ShiftDayDetails({
  employee,
  date,
  data,
  onClose,
  onEdit,
  onAssign,
  canAssign,
}: {
  employee: Employee;
  date: string;
  data: DayData;
  onClose: () => void;
  onEdit: (assignment: Assignment) => void;
  onAssign: () => void;
  canAssign: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center max-h-[85dvh] overflow-y-auto min-w-0">
        <DialogHeader>
          <DialogTitle>
            {employee.firstName} {employee.lastName} · {dayLabel(date)}
          </DialogTitle>
          <DialogDescription>
            Bu günün ayrıntıları. Düzenleme ve silme tüm atama serisine
            uygulanır. Tek gün istisnası desteklenmiyor.
          </DialogDescription>
        </DialogHeader>
        <ShiftCalendarCell
          data={data}
          date={date}
          employeeName={employee.firstName}
        />
        {data.records.map(({ assignment, shift, continuation }) => (
          <div key={assignment._id} className="border-t py-3 space-y-2">
            <p className="font-medium">{shift.name}</p>
            <p className="text-sm tabular-nums">
              {continuation
                ? `Önceki günden · 00:00–${shift.endTime}`
                : shiftTimeLabel(shift)}
            </p>
            <p className="text-sm">
              Seri: {shortDate(assignment.startDate)} – {shortDate(assignment.endDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {assignment.weekPattern?.length
                ? DAYS.filter(([code]) =>
                    assignment.weekPattern?.includes(code),
                  )
                    .map(([, label]) => label)
                    .join(", ")
                : "Her gün"}
            </p>
            <Button variant="outline" onClick={() => onEdit(assignment)}>
              Tüm seriyi düzenle
            </Button>
          </div>
        ))}
        {!canAssign && <p id="day-assign-help" className="text-sm text-muted-foreground">Önce vardiya tanımlayın veya bir tanımı etkinleştirin.</p>}
        <Button aria-describedby={!canAssign ? "day-assign-help" : undefined} disabled={!canAssign} onClick={onAssign}>
          Bu tarihe vardiya ata
        </Button>
      </DialogContent>
    </Dialog>
  );
}
