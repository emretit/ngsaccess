import { Plus, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getShiftColor } from "./lib/shiftColor";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];

interface ShiftCalendarCellProps {
  isToday: boolean;
  cellAssignments: Assignment[];
  shiftMap: Map<string, Shift>;
  onEmptyClick: () => void;
  onAssignmentClick: (assignment: Assignment) => void;
}

export function ShiftCalendarCell({
  isToday,
  cellAssignments,
  shiftMap,
  onEmptyClick,
  onAssignmentClick,
}: ShiftCalendarCellProps) {
  const hasConflict = cellAssignments.length > 1;

  if (cellAssignments.length === 0) {
    return (
      <button
        type="button"
        onClick={onEmptyClick}
        className={cn(
          "group h-14 w-full rounded-md border border-dashed border-transparent transition-colors hover:border-primary/40 hover:bg-primary/5",
          isToday && "bg-primary/5",
        )}
        aria-label="Vardiya ata"
      >
        <Plus className="mx-auto h-4 w-4 text-muted-foreground/0 transition-opacity group-hover:text-primary group-hover:opacity-100 opacity-0" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex h-14 flex-col gap-0.5 rounded-md p-1",
        isToday && "ring-1 ring-primary/40",
        hasConflict && "ring-1 ring-destructive",
      )}
    >
      {cellAssignments.map((a) => {
        const shift = shiftMap.get(a.shiftId);
        const colorClass = getShiftColor(a.shiftId);
        const label = shift?.name ?? "Silinmiş vardiya";
        const time = shift ? `${shift.startTime}–${shift.endTime}` : "—";
        return (
          <TooltipProvider key={a._id} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onAssignmentClick(a)}
                  className={cn(
                    "flex w-full items-center justify-between gap-1 rounded border px-1.5 py-0.5 text-xs font-medium truncate",
                    shift ? colorClass : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  <span className="truncate">{label}</span>
                  {hasConflict && (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {label} · {time}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.startDate} → {a.endDate}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
