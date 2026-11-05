import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { LeaveFilters } from "./LeaveFilters";
import { EmployeePicker } from "./EmployeePicker";
import { readFilters } from "./lib/leaveState";
import type { Id } from "../../../convex/_generated/dataModel";
const mocks = vi.hoisted(() => ({ mobile: false, query: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("convex/react", () => ({ useQuery: mocks.query }));
vi.mock("@/components/ui/select", async original => ({
  ...await original<typeof import("@/components/ui/select")>(),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}));
const projectId = "project" as Id<"projects">;
const filters = readFilters(new URLSearchParams("period=2026-10"));
beforeEach(() => { mocks.mobile = false; mocks.query.mockReturnValue({ options: [], selected: null, truncated: false }); });
const renderFilters = () => renderToStaticMarkup(<LeaveFilters projectId={projectId} filters={filters} onChange={() => {}} onClear={() => {}} />);
describe("leave audit controls", () => {
  it("combines search and person selection in one named combobox", () => {
    const html = renderFilters();
    // Kişi + izin türü; kişi araması ayrı bir combobox açmaz.
    expect(html.match(/role="combobox"/g)).toHaveLength(2);
    expect(html).toContain('id="leave-filter-person"');
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('leave-filter-person-search');
  });
  it("resolves a linked selection even when outside the first 50 options", () => {
    mocks.query.mockReturnValue({ options: [], selected: { _id: "outside", employeeName: "Ayşe Yılmaz" } });
    const html = renderToStaticMarkup(<EmployeePicker projectId={projectId} value="outside" onChange={() => {}} control={{ id: "person", "aria-invalid": false }} />);
    expect(html).toContain("Ayşe Yılmaz");
    expect(html).not.toContain("Seçili kişi");
    expect(mocks.query.mock.calls[mocks.query.mock.calls.length - 1]?.[1]).toMatchObject({ selectedId: "outside" });
  });
  it("names the month with its value and provides one period group", () => {
    const html = renderFilters();
    expect(html).toContain('for="leave-month">Dönem</label>');
    expect(html).toMatch(/<button[^>]*id="leave-month"[^>]*><span[^>]*>Ekim 2026<\/span>/);
    expect(html).toContain("Aralık seç");
    expect(html).not.toContain("Ay seçimi");
    expect(html).not.toContain('id="leave-period"');
  });
  it("uses labeled FIELD controls and keeps clearing visible with no people", () => {
    const html = renderFilters();
    expect(html).toContain('for="leave-filter-person">Kişi</label>');
    expect(html).toContain('for="leave-filter-type">İzin türü</label>');
    expect(html).toContain('Tüm kişiler');
    expect(html).toContain('Tüm türler');
    expect(html).toContain('Filtreleri temizle');
  });
  it("renders the custom range inline before clearing without a dialog or apply button", () => {
    const html = renderToStaticMarkup(<LeaveFilters projectId={projectId} filters={readFilters(new URLSearchParams("period=custom&from=2026-10-01&to=2026-10-31"))} onChange={() => {}} onClear={() => {}} />);
    expect(html).toContain('for="leave-range-start">Başlangıç</label>');
    expect(html).toContain('for="leave-range-end">Bitiş</label>');
    expect(html.indexOf('id="leave-range-end"')).toBeLessThan(html.indexOf('Filtreleri temizle'));
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Uygula');
  });
  it("collapses mobile filters behind an accessible toggle", () => {
    mocks.mobile = true;
    const html = renderFilters();
    const controls = html.match(/<button[^>]*aria-expanded="false" aria-controls="([^"]+)"[^>]*>Filtreler<\/button>/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}" class="hidden md:block"`);
    expect(html).toMatch(/<button[^>]*class="[^"]*md:hidden/);
  });
});
