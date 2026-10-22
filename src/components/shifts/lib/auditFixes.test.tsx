import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftCalendarView } from "../ShiftCalendarView";
import { ShiftDayDetails } from "../ShiftDayDetails";
import { Decision, PreviewPanel, AssignShiftDialog } from "../AssignShiftDialog";
import { AssignmentEditDialog } from "../AssignmentEditDialog";
import { WeekdaySelection } from "../WeekdaySelection";
import { AddShiftDialog } from "../definitions/AddShiftDialog";
import { shortDate, assignmentInitial, cellData, shiftTimeLabel, shiftMessage, type Employee, type Shift, type Assignment, type Preview } from "./planning";
import type { PageHeader } from "@/components/shared/PageHeader";
type PageHeaderProps = ComponentProps<typeof PageHeader>;
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({ shifts: [] as Shift[], calls: [] as string[], primary: null as PageHeaderProps["primaryAction"] | null }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: "project_admin" } }) }));
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference); state.calls.push(name);
    if (name === "employees:list") return [employee];
    if (name === "shifts:list") return state.shifts;
    if (name === "shifts:definitionUsage") return { asOfDate: "2026-10-19", assignmentCount: 1, employeeCount: 1, countLabel: "Toplam", truncated: false, skippedAssignments: 0 };
    if (name === "shifts:previewBulkAssign") return { summary: { total: 1, willAssign: 0, conflict: 1, onLeave: 0, holiday: 0, skipped: 0 }, results: [decision] };
    return [];
  },
}));
vi.mock("@/components/shared/PageHeader", () => ({ PageHeader: (props: PageHeaderProps) => { state.primary = props.primaryAction; return <h1>{props.title}</h1>; } }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box };
});
const employee = { _id: "employee", projectId: "project", firstName: "İpek", lastName: "Yıldız" } as Employee;
const shift = { _id: "night", projectId: "project", name: "Gece", startTime: "22:00", endTime: "06:00", isActive: true } as Shift;
const assignment = { _id: "assignment", employeeId: "employee", shiftId: "night", startDate: "2026-10-19", endDate: "2026-10-25" } as Assignment;
const decision: Preview["results"][number] = {
  employeeId: employee._id, employeeName: "İpek Yıldız", status: "conflict", reason: "İzin: 2026-10-19", occurrenceCount: 1,
  conflict: { assignmentId: assignment._id, shiftId: shift._id, shiftName: shift.name, startDate: assignment.startDate, endDate: assignment.endDate, startTime: shift.startTime, endTime: shift.endTime },
  leave: { leaveId: "leave" as Id<"leaves">, date: "2026-10-19", leaveType: "annual" }, holiday: { holidayId: "holiday" as Id<"holidays">, date: "2026-10-20", name: "Tatil", isHalfDay: false },
};
beforeEach(() => {
  state.shifts = []; state.calls = []; state.primary = null;
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
});
describe("09 denetim düzeltmeleri", () => {
  it("O1/O2/D1/D2/D5: tanımsız projede eylem tanımı açar, imkânsız atama ipucu ve gün sayacı yoktur", () => {
    const html = renderToStaticMarkup(<MemoryRouter><ShiftCalendarView projectId={"project" as Id<"projects">} projectName="Proje" /></MemoryRouter>);
    expect(state.primary?.label).toBe("Önce vardiya tanımla");
    expect(html).not.toContain("Boş bir gün seçerek");
    expect(html).not.toContain(">Gün<");
    expect(html).toContain("flex flex-col gap-1");
    expect(html).toContain('role="combobox"');
    expect(html).not.toMatch(/<select(?! aria-hidden="true")/);
    expect(state.calls).not.toContain("shifts:definitionImpacts");
    expect(state.calls).not.toContain("shifts:assignmentDeleteImpact");
  });
  it("O1/O2: aktif tanım varsa atama ve boş gün yönlendirmesi görünür", () => {
    state.shifts = [shift];
    const html = renderToStaticMarkup(<MemoryRouter><ShiftCalendarView projectId={"project" as Id<"projects">} projectName="Proje" /></MemoryRouter>);
    expect(state.primary?.label).toBe("Vardiya ata");
    expect(html).toContain("Boş bir gün seçerek");
  });
  it("O2/O3/O4: gün ayrıntısı Türkçe seri tarihlerini ve gece etiketini gösterir, pasif atamanın nedenini açıklar", () => {
    const html = renderToStaticMarkup(<ShiftDayDetails employee={employee} date="2026-10-19" data={cellData(employee, "2026-10-19", [assignment], [shift], [], [])} canAssign={false} onClose={() => undefined} onAssign={() => undefined} onEdit={() => undefined} />);
    expect(html).toContain("19.10.2026 – 25.10.2026");
    expect(html).toContain("22:00–06:00 (+1 gün)");
    expect(html).toContain("Önce vardiya tanımlayın");
    expect(html).toContain('aria-describedby="day-assign-help"');
    expect(html).not.toContain("2026-10-19");
  });
  it("O3/O4: önizlemede çakışma, izin, tatil ve eski sunucu mesajları biçimlenir", () => {
    const html = renderToStaticMarkup(<Decision item={decision} />);
    expect(html).toContain("19.10.2026"); expect(html).toContain("20.10.2026"); expect(html).toContain("25.10.2026");
    expect(html).toContain("22:00–06:00 (+1 gün)"); expect(html).not.toMatch(/2026-10-\d\d/);
    expect(shortDate("")).toBe("Tarih seçilmedi");
    expect(shiftMessage("İzin: 2026-10-19")).toBe("İzin: 19.10.2026");
    expect(shiftTimeLabel({ startTime: "08:00", endTime: "16:00" })).toBe("08:00–16:00");
  });
  it("O3/O4/D3/D5: atama ve düzenleme özetleri Türkçe tarih ve gece seçicisini kullanır", () => {
    const assign = renderToStaticMarkup(<AssignShiftDialog open projectId={"project" as Id<"projects">} employees={[employee]} shifts={[shift]} initial={assignmentInitial("2026-10-19")} onOpenChange={() => undefined} />);
    const edit = renderToStaticMarkup(<AssignmentEditDialog open assignment={assignment} shifts={[shift]} employeeName="İpek Yıldız" shiftName="Gece" onOpenChange={() => undefined} />);
    for (const html of [assign, edit]) {
      expect(html).toContain("19.10.2026"); expect(html).toContain('role="combobox"'); expect(html).not.toMatch(/<select(?! aria-hidden="true")/);
      expect(html).toContain("max-sm:min-h-11");
    }
    expect(edit).toContain("Gece · 22:00–06:00 (+1 gün)");
  });
  it("D7: ay veya hafta değişse de yeni atama yalnız seçili günden başlar", () => {
    expect(assignmentInitial("2026-10-19", [employee._id])).toEqual({ startDate: "2026-10-19", endDate: "2026-10-19", employeeIds: [employee._id] });
  });
  it("D8: gün seçimi hatasını grubun tümüne bağlar", () => {
    const html = renderToStaticMarkup(<WeekdaySelection id="days" value={[]} error="Gün seçin" onChange={() => undefined} />);
    expect(html).toContain('<fieldset role="group" aria-describedby="days-error" tabindex="-1">');
    expect(html.match(/type="checkbox"/g)).toHaveLength(7);
    expect(html).toContain('id="days-error"');
    expect(html).toContain("size-6 shrink-0 accent-primary");
  });
  it("D9: önizleme listesinin kendi kaydırma alanı yoktur", () => {
    const html = renderToStaticMarkup(<PreviewPanel values={{ ...assignmentInitial("2026-10-19"), employeeIds: [employee._id], shiftId: shift._id, specificDays: false, weekPattern: [] }} projectId={"project" as Id<"projects">} forceConfirm={false} calendarConfirmed={false} setForceConfirm={() => undefined} setCalendarConfirmed={() => undefined} pending={false} onSave={() => undefined} />);
    expect(html).toContain("Önizleme"); expect(html).not.toContain("overflow-y-auto"); expect(html).not.toContain("max-h-64");
  });
  it("D3/D4: tanım formu seçimleri tema rengi ve 24px alan kullanır, gece süresi korunur", () => {
    const html = renderToStaticMarkup(<AddShiftDialog open editingShift={{ ...shift, overtimeEnabled: true, isActive: true }} onOpenChange={() => undefined} onClose={() => undefined} onAdd={async () => undefined} onUpdate={async () => undefined} />);
    expect(html.match(/size-6 shrink-0 accent-primary/g)).toHaveLength(3);
    expect(html).toContain("max-sm:min-h-11"); expect(html).toContain("Bitiş ertesi gün (+1 gün)"); expect(html).toContain("480"); expect(html).toContain("19.10.2026 itibarıyla");
  });
});
