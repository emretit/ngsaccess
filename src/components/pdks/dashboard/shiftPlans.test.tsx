import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { cellLabel, displaySegmentTime, planDayLabel, segmentTimeRange, singleRowDay, type PdksCell, type PdksRow, type PdksSegment } from "../lib/presentation";
import { PDKSTableView } from "./PDKSTableView";
import { PDKSMobileCardList } from "./PDKSMobileCardList";
import { PDKSHeatmapView } from "./PDKSHeatmapView";
import { PdksDaySegments } from "./PdksDaySegments";
import { PdksPlanSummary } from "./PdksPlanSummary";
import { PDKSEmployeeDetailDrawer } from "./PDKSEmployeeDetailDrawer";

const state = vi.hoisted(() => ({ detail: {} as unknown }));
vi.mock("convex/react", () => ({ useQuery: () => state.detail }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => false }) }));
vi.mock("./PDKSAuditTimeline", () => ({ PDKSAuditTimeline: () => null }));
vi.mock("../ManualPdksEditDialog", () => ({ ManualPdksEditDialog: () => null }));
vi.mock("@/components/ui/sheet", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Sheet: Box, SheetContent: Box, SheetHeader: Box, SheetTitle: Box, SheetDescription: Box };
});
const segments: PdksSegment[] = [
  { shiftId: "s" as Id<"shifts">, shiftName: "Sabah", plannedStart: "08:00", plannedEnd: "12:00", firstISO: "2026-10-19T05:10:00Z", lastISO: "2026-10-19T09:00:00Z", totalMinutes: 230, lateMinutes: 10, earlyExitMinutes: 0, overtimeMinutes: 0, decision: "present" },
  { shiftId: "a" as Id<"shifts">, shiftName: "Akşam", plannedStart: "13:00", plannedEnd: "17:00", firstISO: null, lastISO: null, totalMinutes: 0, lateMinutes: 0, earlyExitMinutes: 0, overtimeMinutes: 0, decision: "absent" },
];
const day: PdksCell = { date: "2026-10-19", firstEntry: "08:10", lastExit: "12:00", totalMinutes: 230, overtimeMinutes: 0, status: "incomplete", leaveType: null, isLate: true, lateMinutes: 10, payrollCode: "—" };
const row: PdksRow = {
  excludedUnknownReadings: 0, id: "e", name: "Ada", employeeId: "e", cardNumber: "1", payrollCode: "—", payrollEmployeeCode: "", department: "Üretim",
  firstEntry: "08:10", lastExit: "12:00", totalHours: "", totalMinutes: 230, overtimeMinutes: 0, overtime: "", overtimeHours: 0, overtimeMultiplier: 1, overtimePayTRY: null, hourlyRate: null, yearlyOvertimeLimit: 270,
  leaveType: "", status: "incomplete", isLate: true, isEarlyExit: false, isManual: false, manualNote: null, manualEditedBy: null, detailedLogs: [], days: [day],
};
const render = renderToStaticMarkup;
const mobile = (record: PdksRow) => render(<PDKSMobileCardList records={[record]} selectedIds={new Set()} onToggleSelect={vi.fn()} />);
const heatmap = (record: PdksRow) => render(<PDKSHeatmapView records={[record]} loading={false} startDate={day.date} endDate={day.date} />);
function drawer(cell: PdksCell) {
  state.detail = { employee: { firstName: "Ada", lastName: "Yılmaz", department: "Üretim", shift: "Eski vardiya" }, summary: {}, days: [{ ...cell, rawReadings: [] }] };
  return render(<PDKSEmployeeDetailDrawer open onOpenChange={vi.fn()} employeeId={"e" as Id<"employees">} startDate={day.date} endDate={day.date} />);
}
describe("PDKS vardiya planı sunumu", () => {
  it("tablo, mobil ve hücre çoklu adı, sayıyı ve sunucunun ilk/son saatlerini gösterir", () => {
    const record = { ...row, days: [{ ...day, segments }] };
    for (const html of [render(<PDKSTableView records={[record]} />), mobile(record), heatmap(record)]) {
      expect(html).toContain("Sabah + Akşam");
      expect(html).toContain("2 vardiya");
      expect(html).toContain("08:10");
      expect(html).toContain("12:00");
    }
    // Mixed decisions retain the existing server-provided status.
    expect(mobile(record)).toContain("İnceleme");
    expect(cellLabel("Ada", day.date, record.days[0])).toContain("2 vardiya, 08:10–12:00");
  });
  it("gün detayında her segmentin planı, süresi ve üç karar etiketi görünür", () => {
    const third = { ...segments[0], shiftId: "n" as Id<"shifts">, shiftName: "Gece", plannedStart: "22:00", plannedEnd: "06:00", decision: "incomplete" as const, earlyExitMinutes: 15 };
    const html = drawer({ ...day, segments: [...segments, third] });
    for (const text of ["Geldi", "Gelmedi", "İncelenecek", "08:00–12:00", "08:10–12:00", "03 sa 50 dk", "00 sa 10 dk", "00 sa 15 dk", "22:00–06:00 (ertesi gün)", "Manuel düzeltme girişi ilk vardiyaya, çıkışı son vardiyaya uygulanır."]) expect(html).toContain(text);
    expect(html).not.toContain("Eski vardiya");
  });
  it("döngü boş günü tüm yüzeylerde hafta tatili tonuyla gösterir", () => {
    const rest = { ...day, planKind: "rest" as const, segments: undefined, status: "weekend" as const, totalMinutes: 0 };
    const record = { ...row, days: [rest], status: rest.status };
    for (const html of [mobile(record), heatmap(record), drawer(rest), render(<PDKSTableView records={[record]} />)]) expect(html).toContain("Boş gün (döngü)");
    expect(heatmap(record)).toContain("bg-muted text-muted-foreground");
    expect(drawer(rest)).not.toContain("Manuel düzeltme girişi ilk vardiyaya");
  });
  it("opsiyonel alanlar yokken eski hücre ve detay çıktısı korunur", () => {
    expect(render(<PdksPlanSummary day={day} />)).toBe("");
    expect(render(<PdksDaySegments day={day} />)).toBe("");
    expect(cellLabel("Ada", day.date, day)).toBe("Ada, 19 Ekim 2026 Pazartesi, İnceleme, 3 saat 50 dakika");
    expect(heatmap(row)).toContain('>— · 03:50</button>');
    const before = drawer(day);
    expect(drawer({ ...day, segments: undefined, planKind: undefined })).toBe(before);
    expect(before).toContain("Vardiya: Eski vardiya");
    expect(before).not.toContain("Günün vardiyaları");
    expect(mobile({ ...row, days: [{ ...day, segments: undefined, planKind: undefined }] })).toBe(mobile(row));
  });
  it("çok günlük toplam satırını tek günün vardiya planı gibi etiketlemez", () => {
    expect(singleRowDay({ days: [{ ...day, segments }, { ...day, date: "2026-10-20" }] })).toBeUndefined();
    expect(planDayLabel({ segments: [] })).toBe("");
    expect(planDayLabel({ segments: [segments[0]] })).toBe("");
  });
  it("segment saatlerini İstanbul saatinde biçimler, olmayan uçları atlar", () => {
    expect(displaySegmentTime("2026-10-19T23:15:00Z")).toBe("02:15");
    expect(displaySegmentTime("invalid")).toBe("—");
    expect(displaySegmentTime(null)).toBe("—");
    expect(segmentTimeRange([...segments, { ...segments[1], lastISO: "2026-10-19T14:00:00Z" }])).toBe("08:10–17:00");
    expect(segmentTimeRange([])).toBe("—");
  });
});

describe("Birleşik denetim: sunucu günü ve segment etiketleri", () => {
  it.each([
    ["present", "M", "bg-success-bg", "text-success"],
    ["weekend", "HT", "bg-muted", "text-muted-foreground"],
  ] as const)("rest planı %s sunucu durumunu ezmez", (status, code, background, color) => {
    const html = heatmap({ ...row, days: [{ ...day, status, planKind: "rest" }] });
    const cellMarkup = html.match(/<button[^>]*aria-label="Ada[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(cellMarkup).toContain(`${background} ${color}`);
    expect(cellMarkup).toContain(`>${code} · 03:50`);
    expect(cellMarkup).toContain("Boş gün (döngü)");
    if (status === "present") expect(cellMarkup).not.toContain(">HT ·");
  });
  it.each([
    ["future", "Bekleniyor"], ["leave", "—"], ["holiday", "—"], ["weekend", "—"],
  ] as const)("%s gününün okutmasız parçaları Gelmedi olarak işaretlenmez", (status, label) => {
    const html = render(<PdksDaySegments day={{ ...day, status, segments: segments.map(segment => ({ ...segment, decision: "absent", firstISO: null, lastISO: null })) }} />);
    expect(html).not.toContain("Gelmedi");
    expect(html).not.toContain("status-danger-badge");
    expect(html.match(new RegExp(`>${label}</div>`, "g"))).toHaveLength(2);
  });
  it("çalışma günündeki Gelmedi ile tatildeki kesin Geldi ve İncelenecek kararları korunur", () => {
    expect(render(<PdksDaySegments day={{ ...day, status: "absent", segments }} />)).toContain("Gelmedi");
    const html = render(<PdksDaySegments day={{ ...day, status: "holiday", segments: [segments[0], { ...segments[1], decision: "incomplete" }] }} />);
    expect(html).toContain("Geldi");
    expect(html).toContain("İncelenecek");
  });
});

describe("Orca turu: kısa hücre ve boş saat aralığı", () => {
  const visibleText = (html: string) => html.replace(/<[^>]*>/g, "");
  it("uzun adları yalnız title/aria içinde tutar, hücre 42px düzeninde kısa rozet basar", () => {
    const longSegments = segments.map(segment => ({ ...segment, shiftName: `TEST ${segment.shiftName} (silinecek)` }));
    const cell = { ...day, segments: longSegments };
    const html = heatmap({ ...row, days: [cell] });
    const cellMarkup = html.match(/<button[^>]*aria-label="Ada[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(cellMarkup).toContain('title="TEST Sabah (silinecek) + TEST Akşam (silinecek)"');
    expect(cellMarkup).toMatch(/aria-label="[^"]*TEST Sabah \(silinecek\) \+ TEST Akşam \(silinecek\)/);
    expect(cellMarkup).toContain("h-[42px] overflow-hidden");
    expect(visibleText(cellMarkup)).not.toContain("TEST");
    expect(visibleText(cellMarkup)).toContain("2 vardiya");
    expect(visibleText(render(<PdksPlanSummary day={cell} />))).toContain("TEST Sabah (silinecek) + TEST Akşam (silinecek)");
    expect(visibleText(render(<PdksPlanSummary day={{ ...day, planKind: "rest" }} compact />))).toBe("Boş gün");
  });
  it("okutmasız aralık ve detay tek çizgi gösterir, heatmap saat satırını basmaz", () => {
    const emptySegments = segments.map(segment => ({ ...segment, firstISO: null, lastISO: null }));
    expect(segmentTimeRange(emptySegments)).toBe("—");
    const detail = render(<PdksDaySegments day={{ ...day, segments: emptySegments }} />);
    expect(detail).not.toContain("—–—");
    expect(detail.match(/Gerçekleşen<\/dt><dd>—<\/dd>/g)).toHaveLength(2);
    const html = heatmap({ ...row, days: [{ ...day, segments: emptySegments }] });
    expect(html).not.toContain('class="block text-[10px] leading-[10px]"');
    expect(html).not.toContain("—–—");
  });
  it.each([
    ["2026-10-19T05:01:00Z", null, "08:01–—"],
    [null, "2026-10-19T14:00:00Z", "—–17:00"],
  ])("tek uç mevcutsa aralığı korur: %s / %s", (firstISO, lastISO, expected) => {
    const partial = { ...segments[0], firstISO, lastISO };
    expect(segmentTimeRange([partial])).toBe(expected);
    expect(render(<PdksDaySegments day={{ ...day, segments: [partial, segments[1]] }} />)).toContain(expected ?? "");
  });
});
