import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePdksTableData } from "./usePdksTableData";
import { usePdksFilterParams } from "./usePdksFilterParams";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
const calls = vi.hoisted(() => [] as unknown[]);
vi.mock("convex/react", () => ({ useQuery: (_reference: unknown, args: unknown) => { calls.push(args); return []; } }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p", loading: false }) }));
const defaults: FilterValues = { reportType: "daily", statusFilter: "all", person: "", dateRange: { from: undefined, to: undefined } };
function Probe() {
  const { filters } = usePdksFilterParams(defaults, "p");
  const { dateRangeLabel } = usePdksTableData(filters);
  return <output>{dateRangeLabel}</output>;
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); calls.length = 0; });
describe("PDKS tarih ve kişi bağlantısı", () => {
  it("employeeId URL parametresini ad aramasına çevirmeden sorguya geçirir", () => {
    renderToStaticMarkup(<MemoryRouter initialEntries={["/pdks-records?employeeId=exact&date=2026-10-19"]}><Probe /></MemoryRouter>);
    expect(calls[0]).toMatchObject({ projectId: "p", employeeId: "exact", person: "", date: "2026-10-19" });
  });
  it("Türkiye dışında ay sınırında İstanbul ayının tamamını sorgular ve başlığı aynı aydan üretir", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T21:30:00Z")); vi.stubEnv("TZ", "America/Los_Angeles");
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/pdks-records?report=monthly"]}><Probe /></MemoryRouter>);
    expect(calls[0]).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(html).toContain("Kasım 2026");
  });
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));
