import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { CardReadingsTable } from "@/components/access-control/CardReadingsTable";
import { GrantRows } from "@/components/access-control/unified/status/StatusViews";
import { ProjectsTable } from "@/components/admin/projects/ProjectsTable";
import { AuditTable } from "@/components/audit/AuditTable";
import { AuditResults } from "@/components/audit/AuditResults";
import { LeaveList } from "@/components/leaves/LeaveList";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShiftCalendarGrid } from "@/components/shifts/ShiftCalendarGrid";
import VisitorTable from "@/components/visitors/VisitorTable";

vi.mock("convex/react", () => ({ usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage", loadMore: vi.fn() }) }));

function renderTable(node: ReactNode) {
  const html = renderToStaticMarkup(node);
  expect(html).toMatch(/<thead[^>]*>.*<tr[ >]/s);
  expect(html).toMatch(/<tbody[^>]*>.*<td[^>]*colSpan="\d+"/s);
  return html;
}

const cardReadingsState = (loading: boolean) => {
    const html = renderTable(<CardReadingsTable readings={[]} loading={loading} onOpen={vi.fn()} />);
    expect(html).toContain("<thead");
    expect(html.match(/<th /g)).toHaveLength(7);
    expect(html).toContain('colSpan="7"');
    expect(html).toMatch(loading ? /<tbody.*aria-busy="true"/s : /<tbody.*Okuma bulunamadı/s);
    expect(html).toContain(loading ? "Erişim okumaları yükleniyor" : "Okuma bulunamadı");
  };

const grantSelectionState = (canManage: boolean) => {
    const html = renderTable(<GrantRows rows={[]} selected={[]} onToggle={() => undefined} onEmployee={() => undefined} canManage={canManage} emptyTitle="Bu filtrelerde kayıt bulunamadı." />);
    expect(html.match(/role="separator"/g)).toHaveLength(3);
    expect(html).toContain('data-column-id="person"');
    expect(html).toMatch(/<thead[^>]*>.*Kişi.*Cihaz\/kapı.*Durum.*<\/thead>/s);
    expect(html).toMatch(new RegExp(`<tbody[^>]*>.*colSpan="${3 + Number(canManage)}".*Bu filtrelerde kayıt bulunamadı.*</tbody>`, "s"));
  };

const grantDeviceLoadingState = () => {
    const html = renderTable(<GrantRows rows={[]} selected={[]} onToggle={() => undefined} onEmployee={() => undefined} canManage hideDevice loading />);
    expect(html).toMatch(/<thead[^>]*>.*Kapı.*<\/thead>/s);
    expect(html).toMatch(/<tbody[^>]*>.*colSpan="4".*Yükleniyor….*<\/tbody>/s);
    expect(html).not.toContain("Bu filtrelerde kayıt bulunamadı.");
  };

const projectsState = (loading: boolean) => {
    const html = renderTable(<ProjectsTable projects={[]} loading={loading} emptyState={<p>Henüz proje yok</p>} onEdit={() => undefined} onDelete={() => undefined} />);
    expect(html).toMatch(/<thead.*Ad.*Durum.*Üyeler.*Oluşturulma.*İşlemler.*<\/thead>/s);
    expect(html).toMatch(/<tbody.*colSpan="5".*<\/tbody>/s);
    expect(html).toContain(loading ? "Projeler yükleniyor" : "Henüz proje yok");
  };

const auditProjectScopeState = (allProjects: boolean) => {
    for (const loading of [false, true]) {
      const html = renderTable(<AuditTable rows={[]} allProjects={allProjects} loading={loading} onSelect={vi.fn()} />);
      expect(html).toContain("<thead");
      expect(html.match(/role="separator"/g)).toHaveLength(allProjects ? 6 : 5);
      expect(html).toContain("Zaman (TR)");
      expect(html).toContain(`colSpan="${allProjects ? 7 : 6}"`);
      expect(html).toMatch(loading ? /<tbody[^>]*>.*aria-busy="true"/s : /<tbody[^>]*>.*Henüz denetim kaydı yok/s);
      expect(html).toContain(loading ? "Denetim kayıtları yükleniyor" : "Henüz denetim kaydı yok");
    }
  };

const auditInitialQueryState = () => {
    const html = renderTable(<AuditResults args={{ allProjects: true }} />);
    expect(html).toContain("<thead");
    expect(html).toContain('colSpan="7"');
    expect(html).toContain("Denetim kayıtları yükleniyor");
  };

const leavesState = (loading: boolean) => {
  const html = renderTable(<LeaveList rows={[]} loading={loading} canManage={false} onDetails={() => {}} onEdit={() => {}} />);
  expect(html).toContain("<thead");
  for (const id of ["employee", "type", "dates", "duration", "status", "actions"]) {
    expect(html).toContain(`data-column-id="${id}"`);
  }
  expect(html.match(/role="separator"/g)).toHaveLength(5);
  for (const label of ["Kişi", "İzin türü", "Tarih aralığı", "Süre", "Durum", "İşlemler"]) expect(html).toContain(label);
  expect(html).toMatch(/<tbody[^>]*><tr[^>]*><td[^>]*colSpan="6"/);
  expect(html).toContain(loading ? "İzin kayıtları yükleniyor." : "Henüz izin kaydı yok.");
};

const pdksDailyState = (loading: boolean) => {
  const html = renderTable(<PDKSTableView records={[]} loading={loading} />);
  for (const label of ["Çalışan", "Departman", "İlk giriş", "Son çıkış", "Toplam süre", "Fazla mesai", "Durum / izin türü", "İşlemler"]) expect(html).toContain(label);
  expect(html).toMatch(/<tbody[^>]*><tr[^>]*><td[^>]*colSpan="9"/);
  expect((html.match(/role="separator"/g) ?? [])).toHaveLength(7);
  expect(html).toContain('data-column-id="select"');
  expect(html).toContain('data-column-id="actions"');
  expect(html).toContain(loading ? "PDKS kayıtları yükleniyor." : "Bu projede personel bulunamadı.");
};

const shiftCalendarState = (count: number) => {
  const days = Array.from({ length: count }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);
  for (const loading of [true, false]) {
    const html = renderTable(<ShiftCalendarGrid employees={[]} days={days} selected={new Set()} getData={() => { throw new Error("No cells should be resolved"); }} onOpen={() => undefined} loading={loading} emptyState={<EmptyState title="Bu projede çalışan yok" action={{ label: "Kişileri aç", onClick: () => undefined }} />} />);
    expect(html).toContain('>Çalışan</th>');
    expect(html.match(/scope="col"/g)).toHaveLength(count + 1);
    expect(html).toContain(`colSpan="${count + 1}"`);
    expect(html).toContain(loading ? "Plan, izin ve tatiller kontrol ediliyor" : "Kişileri aç");
  }
};

const visitorsState = (loading: boolean) => {
    const html = renderTable(<VisitorTable visitors={[]} loading={loading} onOpen={vi.fn()} emptyState={<EmptyState title="Arama devam ediyor" action={{ label: "Daha fazla kayıt tara", onClick: vi.fn() }} />} />);
    expect(html).toContain("<thead");
    expect(html.match(/<th /g)).toHaveLength(7);
    for (const id of ["name", "host", "access-region", "valid-until", "access", "presence", "actions"]) {
      expect(html).toContain(`data-column-id="${id}"`);
    }
    expect(html.match(/role="separator"/g)).toHaveLength(6);
    expect(html).toContain('colSpan="7"');
    expect(html).toMatch(loading ? /<tbody.*aria-busy="true"/s : /<tbody.*Daha fazla kayıt tara/s);
    expect(html).toContain(loading ? "Ziyaretçiler yükleniyor" : "Daha fazla kayıt tara");
  };

it.each([
  { name: "CardReadingsTable.test.tsx: boş ve yükleme durumunda yedi başlığı korur (%s) false", run: () => cardReadingsState(false) },
  { name: "CardReadingsTable.test.tsx: boş ve yükleme durumunda yedi başlığı korur (%s) true", run: () => cardReadingsState(true) },
  { name: "StatusViews.test.tsx: keeps headers and matches the selection column when canManage=%s true", run: () => grantSelectionState(true) },
  { name: "StatusViews.test.tsx: keeps headers and matches the selection column when canManage=%s false", run: () => grantSelectionState(false) },
  { name: "StatusViews.test.tsx: shows loading in the body of the expanded device table", run: () => grantDeviceLoadingState() },
  { name: "ProjectsTable.test.tsx: keeps five headers and one body cell while loading=%s true", run: () => projectsState(true) },
  { name: "ProjectsTable.test.tsx: keeps five headers and one body cell while loading=%s false", run: () => projectsState(false) },
  { name: "AuditTable.test.tsx: boş ve yükleme durumunda başlıkları ve kolon kapsamını korur (%s) false", run: () => auditProjectScopeState(false) },
  { name: "AuditTable.test.tsx: boş ve yükleme durumunda başlıkları ve kolon kapsamını korur (%s) true", run: () => auditProjectScopeState(true) },
  { name: "AuditTable.test.tsx: ilk sorgu yüklenirken tabloyu gösterir", run: () => auditInitialQueryState() },
  { name: "LeaveList.test.tsx: keeps leave headers with no records (loading=%s) false", run: () => leavesState(false) },
  { name: "LeaveList.test.tsx: keeps leave headers with no records (loading=%s) true", run: () => leavesState(true) },
  { name: "PDKSTableView.test.tsx: keeps daily PDKS headers with no records (loading=%s) false", run: () => pdksDailyState(false) },
  { name: "PDKSTableView.test.tsx: keeps daily PDKS headers with no records (loading=%s) true", run: () => pdksDailyState(true) },
  { name: "ShiftCalendarGrid.test.tsx: keeps %s day columns and a spanning empty/loading row 1", run: () => shiftCalendarState(1) },
  { name: "ShiftCalendarGrid.test.tsx: keeps %s day columns and a spanning empty/loading row 7", run: () => shiftCalendarState(7) },
  { name: "ShiftCalendarGrid.test.tsx: keeps %s day columns and a spanning empty/loading row 31", run: () => shiftCalendarState(31) },
  { name: "VisitorTable.test.tsx: boş ve yükleme durumunda yedi başlığı korur (%s) false", run: () => visitorsState(false) },
  { name: "VisitorTable.test.tsx: boş ve yükleme durumunda yedi başlığı korur (%s) true", run: () => visitorsState(true) },
])("$name", ({ run }) => run());
