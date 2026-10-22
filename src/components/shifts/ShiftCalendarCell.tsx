import { shiftTimeLabel } from "./lib/planning";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dayLabel, type DayData } from "./lib/planning";
import { LEAVE_TYPE_LABEL_TR } from "./lib/calendarOverlays";
export function ShiftCalendarCell({
  data,
  date,
  employeeName,
  onOpen,
}: {
  data: DayData;
  date: string;
  employeeName: string;
  onOpen?: () => void;
}) {
  return (
    <div className="relative min-h-[68px] rounded p-2 text-left text-xs break-words hover:bg-subtle">
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${employeeName}, ${dayLabel(date)}, ${data.records.length ? `${data.records.length} atama, ayrıntıları aç` : "atama yok, günü aç"}`}
          className="absolute inset-0 z-10 w-full rounded focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        />
      )}
      <div className="pointer-events-none space-y-1">
        {data.records.slice(0, 2).map(({ assignment, shift, continuation }) => (
          <span key={assignment._id} className="block">
            <span className="block font-medium">{shift.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {continuation
                ? shift.scheduleType === "flexible" ? `Önceki günden · ${shiftTimeLabel(shift)}` : `Önceki günden · 00:00–${shift.endTime}`
                : shiftTimeLabel(shift)}
            </span>
          </span>
        ))}
        {!data.records.length && (
          <span className="block text-muted-foreground">Atama yok</span>
        )}
        {data.records.length > 2 && (
          <span className="block underline">
            +{data.records.length - 2} atama · tümünü gör
          </span>
        )}
        {data.conflict && (
          <StatusBadge
            className="max-w-full whitespace-normal text-left"
            tone="danger"
          >
            Çakışma
          </StatusBadge>
        )}
        {data.leave && (
          <StatusBadge
            className="max-w-full whitespace-normal text-left"
            tone="info"
          >
            {LEAVE_TYPE_LABEL_TR[data.leave.leaveType] ?? data.leave.leaveType}{" "}
            izni
          </StatusBadge>
        )}
        {data.holiday && (
          <StatusBadge
            className="max-w-full whitespace-normal text-left"
            tone="warning"
          >
            {data.holiday.name}
            {data.holiday.isHalfDay ? " · Yarım gün" : ""}
          </StatusBadge>
        )}
      </div>
    </div>
  );
}
