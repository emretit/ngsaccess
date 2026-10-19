import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LeaveFilters } from "./LeaveFilters";
import { EmployeePicker } from "./EmployeePicker";
import { readFilters } from "./lib/leaveState";
import type { Id } from "../../../convex/_generated/dataModel";
const mocks = vi.hoisted(() => ({ mobile: false, query: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("convex/react", () => ({ useQuery: mocks.query }));
const projectId = "project" as Id<"projects">;
const filters = readFilters(new URLSearchParams("period=2026-10"));
beforeEach(() => { mocks.mobile = false; mocks.query.mockReturnValue({ options: [], selected: null, truncated: false }); });
const renderFilters = () => renderToStaticMarkup(<LeaveFilters projectId={projectId} filters={filters} onChange={() => {}} onClear={() => {}} />);
describe("leave audit controls", () => {
  it("combines search and person selection in one named combobox", () => {
    const html = renderFilters();
    expect(html.match(/role="combobox"/g)).toHaveLength(1);
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
    expect(html).toContain('for="leave-month" class="sr-only">Dönem ayı: Ekim 2026');
    expect(html).toContain("Özel aralık…");
    expect(html).not.toContain("Ay seçimi");
    expect(html).not.toContain('id="leave-period"');
  });
  it("collapses mobile filters behind an accessible toggle", () => {
    mocks.mobile = true;
    const html = renderFilters();
    expect(html).toContain('aria-expanded="false" aria-controls="leave-filters"');
    expect(html).toContain('class="hidden flex-wrap');
  });
});
