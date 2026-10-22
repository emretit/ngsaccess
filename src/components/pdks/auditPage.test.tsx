vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.admin, loading: false }) }));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PDKSRecords from "@/pages/PDKSRecords";
import type { FilterValues } from "./dashboard/PDKSFilterBar";
const state = vi.hoisted(() => ({ admin: false, reportType: "daily" as FilterValues["reportType"] }));
vi.mock("convex/react", () => ({ useQuery: () => ({ leaves: 0, corrections: 0, capped: false }), useMutation: () => vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p", activeProject: { name: "Merkez" }, canManage: state.admin, loading: false }) }));
vi.mock("@/hooks/usePdksFilterParams", () => ({ usePdksFilterParams: () => ({ filters: { reportType: state.reportType, statusFilter: "all", person: "", dateRange: {} }, setFilters: vi.fn() }) }));
vi.mock("@/hooks/usePdksFilterOptions", () => ({ usePdksFilterOptions: () => ({ departments: [], companies: [], positions: [], shifts: [] }) }));
vi.mock("@/hooks/usePdksTableData", () => ({ usePdksTableData: () => {
  const records = ["weekend", "holiday", "noData", "future", "notEmployed"].map(status => ({ id: status, status, overtimeHours: 0, days: [{ date: "2026-10-19", status, overtimeMinutes: 0 }] }));
  return { tableRecords: records, allRecords: records, isLoading: false, selectedDate: new Date("2026-10-19T12:00:00"), dateRangeLabel: "19 Ekim 2026", startDate: "2026-10-19", endDate: "2026-10-19" };
} }));
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { DropdownMenu: Box, DropdownMenuContent: Box, DropdownMenuItem: Box, DropdownMenuTrigger: Box };
});
vi.mock("@/components/pdks/dashboard/PDKSEnhancedExportPanel", () => ({ PDKSEnhancedExportPanel: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSFilterBar", () => ({ PDKSFilterBar: () => null, clearPdksFilters: vi.fn() }));
vi.mock("@/components/pdks/dashboard/PDKSTableView", () => ({ PDKSTableView: () => <div>Kayıt tablosu</div> }));
vi.mock("@/components/pdks/dashboard/PDKSHeatmapView", () => ({ PDKSHeatmapView: () => <div>Puantaj tablosu</div> }));
vi.mock("@/components/pdks/dashboard/PDKSChartView", () => ({ PDKSChartView: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSEmployeeDetailDrawer", () => ({ PDKSEmployeeDetailDrawer: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSImportDialog", () => ({ PDKSImportDialog: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSSmartPresets", () => ({ PDKSSmartPresets: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSOvertimeAlert", () => ({ PDKSOvertimeAlert: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSSavedViews", () => ({ PDKSSavedViews: () => null }));
vi.mock("@/components/pdks/PDKSAiChat", () => ({ PDKSAiChat: () => null }));
describe("PDKS sayfa davranışları", () => {
  it("D3/D4/D11: pasif günler özette görünür; işe başlamadan önceki gün sayılmaz; günlük analiz kilitlidir", () => {
    state.reportType = "daily"; state.admin = false;
    const html = renderToStaticMarkup(<PDKSRecords />);
    for (const label of ["Hafta tatili", "Resmî tatil", "Veri yok", "Henüz gelmedi"]) expect(html).toContain(`${label} <strong>1</strong>`);
    expect(html).toContain("Merkez · 19 Ekim 2026");
    expect(html).toMatch(/disabled=""[^>]*aria-pressed="false"[^>]*>Analiz/);
    expect(html).toContain("Kayıt tablosu");
    expect(html).not.toContain("İçe aktar");
  });
  it("O4/D11: içe aktar yöneticiye görünür; haftalıkta analiz kullanılabilir", () => {
    state.reportType = "weekly"; state.admin = true;
    const html = renderToStaticMarkup(<PDKSRecords />);
    expect(html).toContain("İçe aktar");
    expect(html).toContain("Puantaj tablosu");
    expect(html).not.toMatch(/disabled=""[^>]*aria-pressed="false"[^>]*>Analiz/);
  });
});
