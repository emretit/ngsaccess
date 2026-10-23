import { shiftTimeLabel } from "./lib/planning";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dayLabel, type DayData } from "./lib/planning";
import { LEAVE_TYPE_LABEL_TR } from "./lib/calendarOverlays";
import { shiftColorClasses } from "./lib/shiftColors";

export function ShiftDayBadges({ data, compact = false }: { data: DayData; compact?: boolean }) {
  const badges = [
    ...(data.conflict ? [{ label: "Çakışma", short: "!", tone: "danger" as const }] : []),
    ...(data.leave ? [{ label: `${LEAVE_TYPE_LABEL_TR[data.leave.leaveType] ?? data.leave.leaveType} izni`, short: "İ", tone: "info" as const }] : []),
    ...(data.holiday ? [{ label: `${data.holiday.name}${data.holiday.isHalfDay ? " · Yarım gün" : ""}`, short: "T", tone: "warning" as const }] : []),
  ];
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(({ label, short, tone }) => (
        <StatusBadge key={tone} className={compact ? "px-1 py-0 text-[9px]" : "max-w-full whitespace-normal text-left"} tone={tone} role={compact ? "img" : undefined} aria-label={label} title={label}>
          {compact ? short : label}
        </StatusBadge>
      ))}
    </div>
  );
}

function cellTimeLabel(shift: DayData["records"][number]["shift"], continuation: boolean, compact: boolean) {
  const flexible = shift.scheduleType === "flexible";
  if (compact) return flexible ? "Esnek" : `${continuation ? "00:00" : shift.startTime}–${shift.endTime}`;
  if (!continuation) return shiftTimeLabel(shift);
  return flexible ? `Önceki günden · ${shiftTimeLabel(shift)}` : `Önceki günden · 00:00–${shift.endTime}`;
}

export function ShiftCalendarCell({
  data, date, employeeName, onOpen, canAssign = false, compact = false,
}: {
  data: DayData;
  date: string;
  employeeName: string;
  onOpen?: () => void;
  canAssign?: boolean;
  compact?: boolean;
}) {
  const limit = compact ? 1 : 2;
  return (
    <div className={`group relative rounded text-left text-xs break-words hover:bg-subtle ${compact ? "min-h-10 p-0.5" : "min-h-[68px] p-2"}`}>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          title={compact && data.records.length ? data.records.map(({ shift }) => `${shift.name} · ${shiftTimeLabel(shift)}`).join(", ") : undefined}
          aria-label={`${employeeName}, ${dayLabel(date)}, ${data.records.length ? `${data.records.length} atama: ${data.records.map(({ shift }) => shift.name).join(", ")}, ayrıntıları aç` : `atama yok, ${canAssign ? "vardiya ata" : "günü aç"}`}`}
          className="absolute inset-0 z-10 w-full rounded focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          {!data.records.length && canAssign && <span aria-hidden="true" className="text-xl text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">+</span>}
        </button>
      )}
      <div className="pointer-events-none space-y-1">
        {data.records.slice(0, limit).map(({ assignment, shift, continuation }) => {
          const bar = shiftColorClasses(shift.color)?.bar;
          return (
            <span key={assignment._id} className={`block ${bar ? `${bar} pl-1.5` : ""}`} title={`${shift.name} · ${continuation ? "Önceki günden · " : ""}${shiftTimeLabel(shift)}`}>
              {!compact && <span className="block font-medium">{shift.name}</span>}
              <span className={`text-muted-foreground tabular-nums ${compact ? "block text-[10px] leading-tight tracking-tight" : ""}`}>
                {cellTimeLabel(shift, continuation, compact)}
              </span>
            </span>
          );
        })}
        {data.records.length > limit && (
          <span className={compact ? "text-[10px]" : "block underline"}>
            {`+${data.records.length - limit}${compact ? "" : " atama · tümünü gör"}`}
          </span>
        )}
        <ShiftDayBadges data={data} compact={compact} />
      </div>
    </div>
  );
}
