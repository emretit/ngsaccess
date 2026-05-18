import { Plus, AlertTriangle, Sun, Plane } from "lucide-react";
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
import { LEAVE_TYPE_LABEL_TR } from "./lib/calendarOverlays";

type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Holiday = FunctionReturnType<typeof api.holidays.listForRange>[number];
type Leave = FunctionReturnType<typeof api.leaves.listForRange>[number];

interface ShiftCalendarCellProps {
  isToday: boolean;
  cellAssignments: Assignment[];
  shiftMap: Map<string, Shift>;
  holiday?: Holiday | null;
  leave?: Leave | null;
  onEmptyClick: () => void;
  onAssignmentClick: (assignment: Assignment) => void;
}

export function ShiftCalendarCell({
  isToday,
  cellAssignments,
  shiftMap,
  holiday,
  leave,
  onEmptyClick,
  onAssignmentClick,
}: ShiftCalendarCellProps) {
  const hasConflict = cellAssignments.length > 1;
  const bgClass = holiday
    ? "bg-red-50 dark:bg-red-950/30"
    : leave
      ? "bg-amber-50 dark:bg-amber-950/30"
      : "";

  if (cellAssignments.length === 0) {
    return (
      <button
        type="button"
        onClick={onEmptyClick}
        className={cn(
          "group relative h-14 w-full rounded-md border border-dashed border-transparent transition-colors hover:border-primary/40 hover:bg-primary/5",
          isToday && "bg-primary/5",
          bgClass,
        )}
        aria-label="Vardiya ata"
      >
        {(holiday || leave) && (
          <OverlayBadge holiday={holiday} leave={leave} />
        )}
        <Plus className="mx-auto h-4 w-4 text-muted-foreground/0 transition-opacity group-hover:text-primary group-hover:opacity-100 opacity-0" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-14 flex-col gap-0.5 rounded-md p-1",
        isToday && "ring-1 ring-primary/40",
        hasConflict && "ring-1 ring-destructive",
        bgClass,
      )}
    >
      {(holiday || leave) && <OverlayBadge holiday={holiday} leave={leave} />}
      {cellAssignments.map((a) => {
        const shift = shiftMap.get(a.shiftId);
        const colorClass = getShiftColor(a.shiftId);
        const label = shift?.name ?? "Silinmiş vardiya";
        const time = shift ? `${shift.startTime}-${shift.endTime}` : null;
        return (
          <TooltipProvider key={a._id} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onAssignmentClick(a)}
                  className={cn(
                    "flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium truncate",
                    shift ? colorClass : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {time && <span className="font-mono tabular-nums shrink-0">{time}</span>}
                  <span className="truncate">{label}</span>
                  {hasConflict && (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-destructive ml-auto" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">
                  {label}{time ? ` · ${time}` : ""}
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

function OverlayBadge({
  holiday,
  leave,
}: {
  holiday?: Holiday | null;
  leave?: Leave | null;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="absolute right-1 top-1 flex items-center gap-0.5 text-[10px]">
            {holiday && <Sun className="h-3 w-3 text-red-600 dark:text-red-400" />}
            {leave && <Plane className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          {holiday && <p className="font-medium">{holiday.name}</p>}
          {leave && (
            <p className="text-muted-foreground">
              İzin: {LEAVE_TYPE_LABEL_TR[leave.leaveType] ?? leave.leaveType}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
