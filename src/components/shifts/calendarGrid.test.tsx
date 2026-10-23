import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarSelectAll, ShiftCalendarGrid, type CalendarProps } from "./ShiftCalendarGrid";
import { ShiftAgendaView } from "./ShiftAgendaView";
import { ShiftCalendarCell } from "./ShiftCalendarCell";
import { cellData, istanbulToday, visibleRange, type Employee, type Shift, type Assignment } from "./lib/planning";

// The suite runs without a DOM; attach a native-input stand-in to the ref and
// flush mount effects explicitly to verify the non-serializable mixed state.
const hooks = vi.hoisted(() => ({ input: { indeterminate: false }, effects: [] as Array<() => void> }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: () => ({ current: hooks.input }),
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
const employee = { _id: "employee", projectId: "project", firstName: "İpek", lastName: "Yıldız", email: "ipek@example.com" } as Employee;
const empty = cellData(employee, "2026-10-19", [], [], [], []);
const props: CalendarProps = {
  employees: [employee], days: visibleRange(istanbulToday(), "week").days,
  getData: () => empty, selected: new Set(), onSelect: vi.fn(), onOpen: vi.fn(),
};
beforeEach(() => { hooks.effects = []; hooks.input.indeterminate = false; });

describe("Vardiya takvimi sade sunum", () => {
  it("onSelect verilmezse (yetkisiz) seçim kutusu çizmez", () => {
    const html = renderToStaticMarkup(<ShiftCalendarGrid {...props} onSelect={undefined} />);
    expect(html).not.toContain('type="checkbox"');
    const agenda = renderToStaticMarkup(<ShiftAgendaView {...props} days={[props.days[0] ?? "2026-10-19"]} onSelect={undefined} />);
    expect(agenda).not.toContain('type="checkbox"');
  });
  it.each([true, false])("boş hücrede metin gizlenir ve canAssign=%s eylemi adlandırır", (canAssign) => {
    const html = renderToStaticMarkup(<ShiftCalendarCell data={empty} date="2026-10-19" employeeName="İpek Yıldız" canAssign={canAssign} onOpen={() => undefined} />);
    expect(html).not.toContain("Atama yok");
    expect(html).toContain(`atama yok, ${canAssign ? "vardiya ata" : "günü aç"}`);
    expect(html.includes('aria-hidden="true"')).toBe(canAssign);
    if (canAssign) expect(html).toContain("group-focus-within:opacity-100");
  });
  it("hafta 934px alana sığar; bugün ve hafta sonu ayırt edilir; e-posta yalnız title olur", () => {
    const html = renderToStaticMarkup(<ShiftCalendarGrid {...props} />);
    const minWidth = Number(html.match(/min-width:(\d+)px/)?.[1]);
    expect(minWidth).toBeLessThanOrEqual(934);
    expect(minWidth).toBeGreaterThanOrEqual(176 + 7 * 104);
    expect(html.match(/data-today="true"/g)).toHaveLength(2);
    expect(html).toContain('aria-current="date"');
    expect(html).toContain("bg-primary/5 font-bold");
    expect(html).toContain("bg-subtle/60");
    expect(html).toContain('title="ipek@example.com"');
    expect(html).not.toContain(">ipek@example.com<");
    expect(html).not.toContain("Diğer günler için");
    expect(html).toContain("Pzt ");
  });
  it.each([true, false, "indeterminate"] as const)("toplu seçimin %s durumu native checkbox ve ref ile uygulanır", (checked) => {
    const html = renderToStaticMarkup(<CalendarSelectAll selection={{ checked, onToggle: vi.fn() }} label="Çalışan" />);
    for (const effect of hooks.effects) effect();
    expect(hooks.input.indeterminate).toBe(checked === "indeterminate");
    expect(html.includes('checked=""')).toBe(checked === true);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('aria-label="Görünen tüm çalışanları seç"');
  });
  it("ajanda toplu seçimi ve 44px dokunma alanını korur", () => {
    const html = renderToStaticMarkup(<ShiftAgendaView {...props} canAssign selectAll={{ checked: false, onToggle: vi.fn() }} />);
    expect(html).toContain("Tümünü seç");
    expect(html).toContain("min-h-11");
    expect(html).toContain("atama yok, vardiya ata");
  });
  it.each(["fixed", "flexible"] as const)("ayda %s vardiya yalnız saat aralığı veya Esnek gösterir (dar sütunda tire sonrası kırılır)", (scheduleType) => {
    const shift = { _id: "shift", name: "Gündüz", scheduleType, startTime: "08:30", endTime: "18:00" } as Shift;
    const assignment = { _id: "assignment", employeeId: employee._id, shiftId: shift._id, startDate: "2026-10-19", endDate: "2026-10-19" } as Assignment;
    const data = { ...empty, records: [{ shift, assignment, continuation: false }] };
    const html = renderToStaticMarkup(<ShiftCalendarCell data={data} date="2026-10-19" employeeName="İpek Yıldız" compact />);
    expect(html).toContain("min-h-10");
    expect(html).not.toContain("whitespace-nowrap");
    expect(html).toContain("text-[10px] leading-tight");
    expect(html).toContain(scheduleType === "flexible" ? ">Esnek<" : ">08:30–18:00<");
    expect(html).toContain('title="Gündüz · ');
    expect(html).not.toContain(">Gündüz<");
  });
});
