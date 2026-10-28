import { useEffect, useRef, useState, type ReactNode } from "react";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { ShiftCalendarCell } from "./ShiftCalendarCell";
import {
  calendarDayLabel,
  dayLabel,
  istanbulToday,
  type Employee,
  type DayData,
} from "./lib/planning";
export interface CalendarProps {
  loading?: boolean;
  loadingLabel?: string;
  emptyState?: ReactNode;
  employees: Employee[];
  days: string[];
  getData: (employee: Employee, date: string) => DayData;
  onOpen: (employee: Employee, date: string) => void;
  selected: Set<string>;
  /** Verilmezse (yetkisiz kullanıcı) seçim kutuları çizilmez. */
  onSelect?: (id: string) => void;
  /** Boş hücrede "+" ata ipucu gösterilir (yönetici + aktif tanım varken). */
  canAssign?: boolean;
  /** Başlıktaki "görünen tüm çalışanları seç" kutusu. */
  selectAll?: { checked: boolean | "indeterminate"; onToggle: () => void };
}

export function CalendarSelectAll({ selection, label }: {
  selection: NonNullable<CalendarProps["selectAll"]>;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = selection.checked === "indeterminate";
  }, [selection.checked]);
  return (
    <label className="flex min-h-11 items-center gap-2 cursor-pointer">
      <input
        ref={input}
        type="checkbox"
        className="size-6 shrink-0 accent-primary"
        checked={selection.checked === true}
        onChange={selection.onToggle}
        aria-label="Görünen tüm çalışanları seç"
      />
      {label}
    </label>
  );
}

export function ShiftCalendarGrid({
  employees, days, getData, onOpen, selected, onSelect, canAssign, selectAll, loading, loadingLabel, emptyState,
}: CalendarProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const compact = days.length > 7;
  const today = istanbulToday();
  const rows = (loading || emptyState ? [] : employees).map((employee) => ({ employee, cells: days.map((day) => getData(employee, day)) }));
  const mutedDays = days.map((day, index) => {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    return weekday === 0 || weekday === 6 || rows.some(({ cells }) => cells[index]?.holiday);
  });
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => setOverflowing(node.scrollWidth > node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [days.length]);
  // Ay görünümünde bugünün sütunu ilk ekranda görünsün.
  const firstDay = days[0];
  useEffect(() => {
    const node = viewport.current;
    const todayHeader = node?.querySelector<HTMLElement>('th[aria-current="date"]');
    if (!node || !todayHeader || !compact) return;
    node.scrollLeft = Math.max(0, todayHeader.offsetLeft - node.clientWidth / 2);
  }, [firstDay, compact]);
  return (
    <div>
      {overflowing && <p className="text-xs text-muted-foreground mb-2">
        Diğer günler için takvimi yatay kaydırın.
      </p>}
      <div
        ref={viewport}
        role="region"
        aria-label="Vardiya takvimi"
        tabIndex={0}
        className="max-w-full max-h-[65dvh] overflow-auto rounded-md border focus-visible:outline-2 focus-visible:outline-primary"
      >
        <table className="w-full table-fixed text-sm" style={{ minWidth: 176 + days.length * (compact ? 64 : 104) }}>
          <caption className="sr-only">
            Çalışanlara göre {days[0] ? dayLabel(days[0]) : ""} – {days[days.length - 1] ? dayLabel(days[days.length - 1] ?? "") : ""} vardiya planı
          </caption>
          <thead className="sticky top-0 z-20 bg-surface">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-subtle w-[176px] px-2 py-1 text-left">
                {selectAll ? <CalendarSelectAll selection={selectAll} label="Çalışan" /> : "Çalışan"}
              </th>
              {days.map((day, index) => (
                <th
                  key={day}
                  scope="col"
                  aria-current={day === today ? "date" : undefined}
                  data-today={day === today || undefined}
                  className={`px-1 py-2 text-xs border-l whitespace-nowrap ${day === today ? "bg-primary/5 font-bold" : `${mutedDays[index] ? "bg-subtle/60" : "bg-surface"} font-medium`}`}
                >
                  <span aria-hidden="true">{calendarDayLabel(day)}</span>
                  <span className="sr-only">{dayLabel(day)}</span>
                  {day === today && <span className="sr-only">Bugün</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <TableStateRow colSpan={1 + days.length} state="loading" label={loadingLabel ?? "Plan, izin ve tatiller kontrol ediliyor"} /> : emptyState ? <TableStateRow colSpan={1 + days.length} state="custom">{emptyState}</TableStateRow> : rows.map(({ employee, cells }) => (
              <tr key={employee._id} className="border-t">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2 py-1 text-left font-normal">
                  <label className={`flex min-h-11 gap-2 items-center ${onSelect ? "cursor-pointer" : ""}`}>
                    {onSelect && <input
                      type="checkbox" className="size-6 shrink-0 accent-primary"
                      checked={selected.has(employee._id)}
                      onChange={() => onSelect(employee._id)}
                      aria-label={`${employee.firstName} ${employee.lastName} seç`}
                    />}
                    <span className="min-w-0 break-words font-medium" title={employee.email}>
                      {employee.firstName} {employee.lastName}
                    </span>
                  </label>
                </th>
                {days.map((day, index) => {
                  const data = cells[index];
                  if (!data) return null;
                  return (
                    <td key={day} data-today={day === today || undefined} className={`align-top border-l ${compact ? "p-0.5" : "p-1"} ${day === today ? "bg-primary/5" : mutedDays[index] ? "bg-subtle/60" : ""}`}>
                      <ShiftCalendarCell
                        data={data}
                        date={day}
                        employeeName={`${employee.firstName} ${employee.lastName}`}
                        onOpen={() => onOpen(employee, day)}
                        canAssign={canAssign}
                        compact={compact}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
