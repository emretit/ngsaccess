import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarNavigation, calendarRangeLabel } from "./CalendarNavigation";
import { openCalendarDay } from "./calendarActions";
import { cellData, visibleRange, type Employee, type Shift, type Assignment } from "../lib/planning";

const permissions = vi.hoisted(() => ({ manage: false, reports: false }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (key: string) => key === "schedule.manage" ? permissions.manage : permissions.reports }) }));
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return Object.fromEntries(["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSub", "DropdownMenuSubTrigger", "DropdownMenuSubContent", "DropdownMenuLabel"].map(key => [key, Box]));
});
const noOp = () => undefined;
const employee = { _id: "employee", projectId: "project", firstName: "İpek", lastName: "Yıldız" } as Employee;
const shift = { _id: "shift", projectId: "project", name: "Gündüz", startTime: "08:00", endTime: "16:00", isActive: true } as Shift;
const header = (activeCount = 1) => renderToStaticMarkup(<CalendarHeader activeCount={activeCount} loading={false} exporting={false} onAssign={noOp} openDefinitions={noOp} onExport={noOp} onClear={noOp} />);
beforeEach(() => { permissions.manage = false; permissions.reports = false; });

describe("Vardiya başlık ve araç çubuğu", () => {
  it("proje kapsamı yoktur; yetkisiz kullanıcıda İşlemler ve atama görünmez", () => {
    const html = header();
    expect(html).toContain("Vardiya tanımları");
    expect(html).not.toContain("Çalışma planı");
    expect(html).not.toContain("İşlemler");
    expect(html).not.toContain("Vardiya ata");
  });
  it("rapor yetkisinde dışa aktarma alt menüsü ve kapsam açıklaması vardır", () => {
    permissions.reports = true;
    const html = header();
    for (const text of ["İşlemler", "Dışa aktar", "Excel (.xlsx)", "CSV", "Görünen sayfa ve dönem"]) expect(html).toContain(text);
    expect(html).not.toContain("Toplu temizle");
  });
  it("yöneticide temizleme vardır; aktif tanım yokken atama eylemi yoktur", () => {
    permissions.manage = true;
    const html = header(0);
    expect(html).toContain("Toplu temizle");
    expect(html).not.toContain("Dışa aktar");
    expect(html).not.toContain("Vardiya ata");
    expect(header()).toContain("Vardiya ata");
  });
  it("aralıklar kısa Türkçe biçiminde yazılır", () => {
    expect(calendarRangeLabel("2026-10-19", "2026-10-25", "week")).toBe("19–25 Ekim 2026");
    expect(calendarRangeLabel("2026-10-27", "2026-11-02", "week")).toBe("27 Eki – 2 Kas 2026");
    expect(calendarRangeLabel("2026-10-01", "2026-10-31", "month")).toBe("Ekim 2026");
    expect(calendarRangeLabel("2026-10-23", "2026-10-23", "day")).toBe("23 Ekim 2026 Cum");
    expect(calendarRangeLabel("2026-12-28", "2027-01-03", "week")).toBe("28 Ara 2026 – 3 Oca 2027");
  });
  it("kompakt araç çubuğunda dönem grubu yoktur, tarih tetikleyicisi erişilebilirdir", () => {
    const html = renderToStaticMarkup(<CalendarNavigation day="2026-10-23" effectivePeriod="day" period="week" compact range={visibleRange("2026-10-23", "day")} changeDay={noOp} setPeriod={noOp} clearSelection={noOp} />);
    expect(html).not.toContain('aria-label="Dönem"');
    for (const label of ["Önceki dönem", "Sonraki dönem", "Tarih seç"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("İstanbul saati");
  });
});

describe("Boş hücreden atama", () => {
  it("atanabilir boş hücrede çalışan ve tek gün ile doğrudan atama açılır", () => {
    const assign = vi.fn(); const detail = vi.fn();
    openCalendarDay(employee, "2026-10-23", true, cellData(employee, "2026-10-23", [], [shift], [], []), assign, detail);
    expect(assign).toHaveBeenCalledWith({ employeeIds: [employee._id], startDate: "2026-10-23", endDate: "2026-10-23" });
    expect(detail).not.toHaveBeenCalled();
  });
  it("yetki ya da aktif tanım yoksa boş hücre ayrıntıyı açar", () => {
    const assign = vi.fn(); const detail = vi.fn();
    openCalendarDay(employee, "2026-10-23", false, cellData(employee, "2026-10-23", [], [shift], [], []), assign, detail);
    expect(assign).not.toHaveBeenCalled();
    expect(detail).toHaveBeenCalledWith({ employee, date: "2026-10-23" });
  });
  it("dolu hücre atama yerine ayrıntıyı açar", () => {
    const assign = vi.fn(); const detail = vi.fn();
    const assignment = { _id: "assignment", employeeId: employee._id, shiftId: shift._id, startDate: "2026-10-23", endDate: "2026-10-23" } as Assignment;
    openCalendarDay(employee, "2026-10-23", true, cellData(employee, "2026-10-23", [assignment], [shift], [], []), assign, detail);
    expect(assign).not.toHaveBeenCalled();
    expect(detail).toHaveBeenCalledWith({ employee, date: "2026-10-23" });
  });
});
