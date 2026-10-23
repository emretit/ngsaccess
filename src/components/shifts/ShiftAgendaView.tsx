import { CalendarSelectAll, type CalendarProps } from "./ShiftCalendarGrid";
import { ShiftCalendarCell } from "./ShiftCalendarCell";
import { dayLabel } from "./lib/planning";
export function ShiftAgendaView({
  employees, days, getData, onOpen, selected, onSelect, canAssign, selectAll,
}: CalendarProps) {
  const day = days[0];
  if (!day) return null;
  return (
    <section aria-label={`${dayLabel(day)} ajandası`} className="min-w-0 border-y divide-y">
      {selectAll && <CalendarSelectAll selection={selectAll} label="Tümünü seç" />}
      {employees.map((employee) => (
        <div key={employee._id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 py-1 min-w-0">
          <label className={`flex min-h-11 items-center gap-2 font-medium break-words ${onSelect ? "cursor-pointer" : ""}`}>
            {onSelect && <input
              type="checkbox" className="size-6 shrink-0 accent-primary"
              checked={selected.has(employee._id)}
              onChange={() => onSelect(employee._id)}
              aria-label={`${employee.firstName} ${employee.lastName} seç`}
            />}
            <span title={employee.email}>{employee.firstName} {employee.lastName}</span>
          </label>
          <ShiftCalendarCell
            data={getData(employee, day)}
            date={day}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            onOpen={() => onOpen(employee, day)}
            canAssign={canAssign}
          />
        </div>
      ))}
    </section>
  );
}
