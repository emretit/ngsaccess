vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.admin, loading: state.projectLoading }) }));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PDKSRecords from "@/pages/PDKSRecords";
import type { FilterValues } from "./dashboard/PDKSFilterBar";
const state = vi.hoisted(() => ({ admin: false, projectId: "p" as string | null, projectLoading: false, failed: false, search: "", reportType: "daily" as FilterValues["reportType"] }));
vi.mock("convex/react", () => ({ useQuery: () => ({ count: 2, capped: false }), useMutation: () => vi.fn() }));
vi.mock("@/components/shifts/ShiftTree", () => ({ ShiftTree: () => <div>Vardiya ağacı</div> }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: "/pdks-records", search: state.search }), Navigate: ({ to }: { to: string }) => <a href={to}>Yönlendir</a>, Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a> }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: state.projectId, activeProject: { name: "Merkez" }, canManage: state.admin, loading: state.projectLoading }) }));
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
vi.mock("@/components/pdks/dashboard/PDKSEnhancedExportPanel", () => ({ PDKSEnhancedExportPanel: ({ children }: { children: (menu: ReactNode) => ReactNode }) => children(<div>Dışa aktar</div>) }));
vi.mock("@/components/pdks/dashboard/PDKSFilterBar", () => ({ PDKSFilterBar: () => null, clearPdksFilters: vi.fn() }));
vi.mock("@/components/pdks/dashboard/PDKSTableView", () => ({ PDKSTableView: () => <div>Kayıt tablosu</div> }));
vi.mock("@/components/pdks/dashboard/PDKSHeatmapView", () => ({ PDKSHeatmapView: () => <div>Puantaj tablosu</div> }));
vi.mock("@/components/pdks/dashboard/PDKSEmployeeDetailDrawer", () => ({ PDKSEmployeeDetailDrawer: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSImportDialog", () => ({ PDKSImportDialog: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSSmartPresets", () => ({ PDKSSmartPresets: () => null }));
vi.mock("@/components/pdks/dashboard/PDKSOvertimeAlert", () => ({ PDKSOvertimeAlert: () => null }));
vi.mock("@/components/pdks/PDKSAiChat", () => ({ PDKSAiChat: () => null }));
afterEach(() => { state.projectId = "p"; state.projectLoading = false; state.search = ""; state.failed = false; });
describe("PDKS sayfa davranışları", () => {
  it("D3/D4/D11: pasif günler özette görünür; işe başlamadan önceki gün sayılmaz; Analiz ve düzeltme talebi yok", () => {
    state.reportType = "daily"; state.admin = false;
    const html = renderToStaticMarkup(<PDKSRecords />);
    for (const label of ["Hafta tatili", "Resmî tatil", "Veri yok", "Henüz gelmedi"]) expect(html).toContain(`${label} <strong>1</strong>`);
    expect(html).toContain("Merkez · 19 Ekim 2026");
    expect(html).not.toContain(">Analiz<");
    expect(html).not.toContain("Düzeltme talepleri");
    expect(html).toContain("Kayıt tablosu");
    expect(html).not.toContain("Vardiya ağacı");
    expect(html).not.toContain("İçe aktar");
  });
  it("O4/D11: içe aktar yöneticiye görünür; haftalıkta puantaj tablosu gelir", () => {
    state.reportType = "weekly"; state.admin = true;
    const html = renderToStaticMarkup(<PDKSRecords />);
    expect(html).toContain("İçe aktar");
    expect(html).toContain("Puantaj tablosu");
    expect(html).toContain("Düzeltme talepleri");
    expect(html).toContain("Bekleyen düzeltme sayısı");
  });
  it("Ayarlar düğmesi PDKS kayıtlarında görünmez; vardiya planı bordo renktedir", () => {
    state.reportType = "daily"; state.admin = true;
    const html = renderToStaticMarkup(<PDKSRecords />);
    expect(html).not.toContain('href="/pdks-records/settings"');
    expect(html).toMatch(/class="[^"]*bg-primary[^"]*"[^>]*>.*Vardiya planı/);
  });
  it("Dışa aktar İşlemler menüsünde; ayrı Dışa aktar/Diğer düğmesi yok", () => {
    state.reportType = "daily"; state.admin = true;
    const html = renderToStaticMarkup(<PDKSRecords />);
    expect(html).toMatch(/>İşlemler<\/button>.*Dışa aktar.*İçe aktar.*Uyarılar.*Asistan/);
    expect(html).not.toContain(">Diğer<");
  });
});

it.each(['loading', 'no-project'])('keeps the PDKS heading during project state: %s', status => {
  state.projectLoading = status === 'loading';
  state.projectId = status === 'no-project' ? null : 'p';
  const html = renderToStaticMarkup(<PDKSRecords />);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toMatch(/<main\b/);
  expect(html).toContain('PDKS');
  expect(html).not.toContain('Kayıt tablosu');
  expect(html).toContain(status === 'loading' ? 'PDKS kayıtları yükleniyor' : 'Bir proje seçin');
});
it('preserves legacy plan redirects and other search parameters', () => {
  state.search = '?plan=1&shift=day&person=Ada';
  const html = renderToStaticMarkup(<PDKSRecords />);
  expect(html).toContain('href="/pdks-records/plan?shift=day&amp;person=Ada"');
  expect(html).not.toContain('<h1');
});

vi.mock("@/components/shared/QuerySectionBoundary", () => ({
  QuerySectionBoundary: ({ children, renderFallback }: { children: ReactNode; renderFallback?: (retry: () => void) => ReactNode }) => state.failed && renderFallback ? renderFallback(() => undefined) : <>{children}</>,
}));
it("keeps the PDKS identity when its outer query boundary fails", () => {
  state.failed = true;
  const html = renderToStaticMarkup(<PDKSRecords />);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("PDKS");
  expect(html).toContain("PDKS kayıtları yüklenemedi.");
  expect(html).toContain("Tekrar Dene");
  expect(html).not.toMatch(/<main\b/);
  expect(html).not.toContain("Kayıt tablosu");
});
