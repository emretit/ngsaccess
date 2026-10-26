vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => mocks.reportsAllowed, loading: mocks.permissionsLoading }) }));
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PDF_MAX_ROWS, PDF_ROW_LIMIT_MESSAGE } from '@/lib/reports/export';
import { ReportPage, reportExportLabel } from './ReportPage';
import { ReportResults } from './ReportResults';
import type { Id } from '../../../convex/_generated/dataModel';
import { toggleHiddenColumn } from '@/lib/reports/columns';
import { dailyCell, dailySource, monthlySheet, transactionPage } from '@/lib/reports/testFixtures';
import { flattenDailyRows } from '@/lib/reports/rows';
import { buildPersonMonthRows } from '@/lib/reports/personMonth';
import { dailyReportArgs } from '@/lib/reports/query';
import { REPORTS, type ReportDefinition } from '@/lib/reports/registry';
import Reports from '@/pages/Reports';
const mocks = vi.hoisted(() => ({ permissionsLoading: false, reportsAllowed: true, role: 'project_user', scoped: false, query: vi.fn(), convexQuery: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { role: mocks.role, _id: 'user-a' } }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ loading: false, projectId: mocks.scoped ? 'project-a' : null }) }));
vi.mock('convex/react', () => ({ useQuery: mocks.query, useConvex: () => ({ query: mocks.convexQuery }) }));
const definition: ReportDefinition = { slug: 'example', group: 'gunluk', title: 'Örnek rapor', description: 'Örnek', dataSource: 'pdksMatrix', filters: [], formats: ['csv'], columns: [
  { key: 'name', label: 'Ad Soyad', defaultVisible: true, value: row => row.kind === 'daily' ? row.name : null },
  { key: 'department', label: 'Departman', defaultVisible: true, value: row => row.kind === 'daily' ? row.department : null },
] };
afterEach(() => { vi.unstubAllGlobals(); mocks.permissionsLoading = false; mocks.reportsAllowed = true; mocks.role = 'project_user'; mocks.scoped = false; mocks.query.mockReset(); });
describe('generic report display', () => {
  it('honors saved column hiding for both the header and data', () => {
    const hidden = toggleHiddenColumn([], 'department');
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(hidden) });
    const html = renderToStaticMarkup(<ReportPage projectId="project-a" definition={definition} rows={flattenDailyRows([dailySource([dailyCell()])])} meta={{ from: '2026-10-19', to: '2026-10-19' }} />);
    expect(html).toContain('scope="col"'); expect(html).toContain('Ayşe Yılmaz'); expect(html).not.toContain('Üretim'); expect(html).not.toContain('>Departman</th>');
    expect(toggleHiddenColumn(hidden, 'department')).toEqual([]);
  });
  it('can reveal a column that is hidden by default and ignores malformed storage', () => {
    const custom = { ...definition, columns: definition.columns.map(column => column.key === 'department' ? { ...column, defaultVisible: false } : column) };
    const rows = flattenDailyRows([dailySource([dailyCell()])]);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(toggleHiddenColumn([], 'department', false)) });
    expect(renderToStaticMarkup(<ReportPage projectId="project-a" definition={custom} rows={rows} meta={{ from: '2026-10-19', to: '2026-10-19' }} />)).toContain('Üretim');
    vi.stubGlobal('localStorage', { getItem: () => 'not-json' });
    expect(renderToStaticMarkup(<ReportPage projectId="project-a" definition={custom} rows={rows} meta={{ from: '2026-10-19', to: '2026-10-19' }} />)).not.toContain('Üretim');
  });
  it('provides an actionable empty state and a disabled export control', () => {
    const html = renderToStaticMarkup(<ReportPage projectId="project-a" definition={definition} rows={[]} meta={{ from: '2026-10-19', to: '2026-10-19' }} />);
    expect(html).toContain('Kayıt bulunamadı'); expect(html).toContain('Seçili dönem ve filtreler için.'); expect(html).toContain('disabled=""');
  });
  it('explains the PDF limit while keeping Excel available', () => {
    const source = flattenDailyRows([dailySource([dailyCell()])])[0];
    const rows = Array.from({ length: PDF_MAX_ROWS + 1 }, (_, i) => ({ ...source, id: String(i) }));
    const html = renderToStaticMarkup(<ReportPage projectId="project-a" definition={{ ...definition, formats: ['excel', 'pdf'] }} rows={rows} meta={{ from: '2026-10-01', to: '2026-10-31' }} />);
    expect(html).toContain(PDF_ROW_LIMIT_MESSAGE);
    expect(html).toContain('Dışa aktar');
    expect(renderToStaticMarkup(<ReportPage projectId="project-a" definition={{ ...definition, formats: ['pdf'] }} rows={rows.slice(0, PDF_MAX_ROWS)} meta={{ from: '2026-10-01', to: '2026-10-31' }} />)).not.toContain(PDF_ROW_LIMIT_MESSAGE);
  });
  it('keeps server-filtered transaction results and a concise export note', () => {
    const transactions = REPORTS.find(report => report.dataSource === 'transactions');
    if (!transactions) throw new Error('Missing transaction report');
    mocks.query.mockReturnValue(transactionPage('reading'));
    const html = renderToStaticMarkup(<ReportResults definition={transactions} projectId={'project-a' as Id<'projects'>} from="2026-10-01" to="2026-10-31" person="Mehmet" year={2026} month={10} />);
    expect(html).not.toContain('biyometrik kayıt gizlendi');
    expect(html).toContain('Yalnız yüklenen kayıtlar dışa aktarılır.');
    expect(html).toContain('Ayşe Yılmaz');
    expect(html).not.toContain('filtreleri yüklenen');
  });
  it('offers more loading for an empty scanned page and the final empty state only when done', () => {
    const report = REPORTS.find(item => item.slug === 'mobil-okutmalar');
    if (!report) throw new Error('Missing mobile report');
    for (const isDone of [false, true]) {
      mocks.query.mockReturnValue({ ...transactionPage('empty', isDone), page: [] });
      const html = renderToStaticMarkup(<ReportResults definition={report} projectId={'project-a' as Id<'projects'>} from="2026-10-01" to="2026-10-31" person="" year={2026} month={10} />);
      expect(html.includes('Kayıt bulunamadı')).toBe(isDone);
      expect(html.includes('Taranan kayıtlarda eşleşme yok.')).toBe(!isDone);
      expect(html.includes('>Daha fazla yükle</button>')).toBe(!isDone);
      expect(html).not.toContain('Tüm kayıtlar yüklendi');
      expect(html).not.toContain('biyometrik kayıt gizlendi');
      expect(html).not.toContain('Biyometrik doğrulamalı geçişler KVKK gereği');
    }
  });
  it('renders only 50 rows on the first page', () => {
    const source = flattenDailyRows([dailySource([dailyCell()])])[0];
    const rows = Array.from({ length: 51 }, (_, i) => ({ ...source, id: String(i), name: `Kişi-${i}` }));
    const html = renderToStaticMarkup(<ReportPage projectId="project-a" definition={definition} rows={rows} meta={{ from: '2026-10-19', to: '2026-10-19' }} />);
    expect(html).toContain('Kişi-49'); expect(html).not.toContain('Kişi-50'); expect(html).toContain('1 / 2');
  });
  it('uses the monthly source for department summaries and ignores a stale person search', () => {
    const report = REPORTS.find(item => item.slug === 'departman-bazli-devam');
    if (!report) throw new Error('Missing department report');
    mocks.query.mockReturnValue(monthlySheet());
    const html = renderToStaticMarkup(<ReportResults definition={report} projectId={'project-a' as Id<'projects'>} from="2026-10-01" to="2026-10-31" person="Mehmet" year={2026} month={10} departmentName="Üretim" />);
    expect(html).toContain('Üretim'); expect(html).toContain('Çalışılan kişi-gün'); expect(html).toContain('>100<');
    expect(html).not.toContain('Ayşe Yılmaz'); expect(html).not.toContain('Kodlar:');
    expect(mocks.query.mock.calls[0]?.[1]).toEqual({ projectId: 'project-a', year: 2026, month: 10 });
  });
  it('requests mobile and QR sources and displays punches using the daily matrix route', () => {
    const mobile = REPORTS.find(item => item.slug === 'mobil-okutmalar');
    const card = REPORTS.find(item => item.slug === 'okutma-karti');
    if (!mobile || !card) throw new Error('Missing record reports');
    const props = { projectId: 'project-a' as Id<'projects'>, from: '2026-10-01', to: '2026-10-31', person: '', year: 2026, month: 10 };
    mocks.query.mockReturnValue(transactionPage());
    renderToStaticMarkup(<ReportResults definition={mobile} {...props} />);
    expect(mocks.query.mock.calls[0]?.[1]).toMatchObject({ sources: ['mobile', 'qr'], paginationOpts: { numItems: 50, cursor: null } });
    const cell = dailyCell();
    if (!cell.detail) throw new Error('Missing detail');
    cell.detail.punches = [{ time: '08:58', direction: 'entry' }];
    mocks.query.mockReturnValue([dailySource([cell])]);
    const html = renderToStaticMarkup(<ReportResults definition={card} {...props} />);
    expect(html).toContain('08:58 Giriş'); expect(html).toContain('whitespace-normal'); expect(html).not.toContain('Biyometrik doğrulamalı');
    expect(mocks.query.mock.calls[1]?.[1]).toMatchObject({ viewMode: 'matrix', startDate: props.from, endDate: props.to, includePunches: true });
  });
});
function route(path: string) { return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Routes><Route path="/reports/:group?/:slug?" element={<Reports />} /></Routes></MemoryRouter>); }
describe('report routes', () => {
  it('hides person search on department attendance and retains it on person attendance', () => {
    mocks.scoped = true;
    mocks.query.mockImplementation((_query, args: unknown) => args && typeof args === 'object' && 'year' in args ? monthlySheet() : []);
    expect(route('/reports/aylik/departman-bazli-devam?q=Ayşe')).not.toContain('type="search"');
    expect(route('/reports/aylik/kisi-bazli-devam')).toContain('type="search"');
  });
  it('renders the four groups and eighteen reports in the hub', () => { const html = route('/reports'); expect(html).toContain('Kayıtlar'); expect(html).toContain('Resmi'); for (const report of REPORTS) expect(html).toContain(`/reports/${report.group}/${report.slug}`); });
  it('provides recovery for unknown groups, mismatched slugs and official slugs', () => { for (const path of ['/reports/invalid', '/reports/gunluk/ham-okutmalar', '/reports/resmi/sgk']) expect(route(path)).toContain('Rapor bulunamadı'); });
  it('gates official settings links and skips all queries when no project is selected', () => {
    mocks.reportsAllowed = false;
    expect(route('/reports/resmi')).toContain('Proje erişimi yok');
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.reportsAllowed = true;
    expect(route('/reports/resmi')).toContain('/settings?tab=reports');
    for (const report of REPORTS) expect(route(`/reports/${report.group}/${report.slug}`)).toContain('Bir proje seçin'); expect(mocks.query).not.toHaveBeenCalled();
  });
});

it("rapor yetkisi yüklenirken erişim reddi yerine iskelet gösterir ve veri sorgulamaz", () => {
  mocks.reportsAllowed = false;
  mocks.permissionsLoading = true;
  const html = renderToStaticMarkup(<MemoryRouter><Reports /></MemoryRouter>);
  expect(html).toContain("Raporlar yükleniyor");
  expect(html).not.toContain("Proje erişimi yok");
  expect(mocks.query).not.toHaveBeenCalled();
});

vi.mock('react-router-dom', async importOriginal => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  Navigate: vi.fn(() => null),
}));
it('replaces the legacy break URL and preserves its search filters', () => {
  route('/reports/gunluk/mola-ihlalleri?from=2026-10-01&to=2026-10-20&dept=d1&q=Ada&ihlal=0');
  const props = vi.mocked(Navigate).mock.calls[vi.mocked(Navigate).mock.calls.length - 1]?.[0];
  expect(props?.replace).toBe(true);
  expect(props?.to).toEqual({ pathname: '/reports/gunluk/mola', search: '?from=2026-10-01&to=2026-10-20&dept=d1&q=Ada&ihlal=1' });
});
it('applies the violations-only client filter while keeping server args unchanged', () => {
  const report = REPORTS.find(item => item.slug === 'mola');
  const detail = dailyCell().detail;
  if (!report || !detail) throw new Error('Missing break fixture');
  mocks.query.mockReturnValue([dailySource([
    dailyCell({ date: '2026-10-01', detail: { ...detail, breaks: [{ start: '12:00', end: '13:00', minutes: 60 }], breakMinutes: 60 } }),
    dailyCell({ date: '2026-10-02', detail: { ...detail, breakViolation: true } }),
  ])]);
  const props = { definition: report, projectId: 'p' as Id<'projects'>, from: '2026-10-01', to: '2026-10-02', person: '', year: 2026, month: 10 };
  const all = renderToStaticMarkup(<ReportResults {...props} />);
  const args = mocks.query.mock.calls[mocks.query.mock.calls.length - 1]?.[1];
  const violations = renderToStaticMarkup(<ReportResults {...props} violationsOnly />);
  expect(all).toContain('01.10.2026');
  expect(violations).not.toContain('01.10.2026</td>');
  expect(violations).toContain('02.10.2026');
  expect(mocks.query.mock.calls[mocks.query.mock.calls.length - 1]?.[1]).toEqual(args);
});

it('uses month filters for the daily matrix summary and requests the full leap month', () => {
  mocks.scoped = true;
  mocks.query.mockReturnValue([]);
  const html = route('/reports/aylik/aylik-ozet?month=2028-02&from=2026-01-01&to=2026-01-02&preset=custom');
  expect(html).toContain('Aylık Özet');
  expect(html).toContain('for="report-period">Ay</label>');
  expect(html).not.toContain('id="report-from"');
  expect(html).toContain('01.02.2028 – 29.02.2028');
  const report = REPORTS.find(item => item.slug === 'aylik-ozet');
  if (!report) throw new Error('Missing summary');
  expect(dailyReportArgs({ projectId: 'p' as Id<'projects'>, from: '2028-02-01', to: '2028-02-29', person: '', year: 2028, month: 2 }, report)).toEqual(expect.objectContaining({ startDate: '2028-02-01', endDate: '2028-02-29', viewMode: 'matrix', includePunches: true }));
});
it('fetches month summaries once instead of subscribing to every new reading', () => {
  const report = REPORTS.find(item => item.slug === 'aylik-ozet');
  if (!report) throw new Error('Missing summary');
  mocks.query.mockReturnValue([dailySource([dailyCell()])]);
  const html = renderToStaticMarkup(<ReportResults definition={report} projectId={'project-a' as Id<'projects'>} from="2026-10-01" to="2026-10-31" person="" year={2026} month={10} />);
  expect(mocks.query).toHaveBeenCalledWith(expect.anything(), 'skip');
  expect(html).toContain('Rapor yükleniyor');
  expect(html).toContain('Yeniden yükle');
});
it('displays one summary row per person and labels the specialized exports', () => {
  const report = REPORTS.find(item => item.slug === 'aylik-ozet');
  if (!report) throw new Error('Missing summary');
  const rows = buildPersonMonthRows([dailySource([dailyCell(), dailyCell({ date: '2026-10-20', totalMinutes: 60 })])]);
  const html = renderToStaticMarkup(<ReportPage projectId="project-a" definition={report} rows={rows} meta={{ from: '2026-10-01', to: '2026-10-31' }} />);
  expect(html).toContain('1 kayıt');
  expect(html).toContain('9 sa 55 dk');
  expect(html).toContain('İnceleme (gün)');
  expect(reportExportLabel('excel', report)).toBe('Excel (kişi blokları)');
  for (const [slug, label] of [['kisi-devam-dokumu', 'Excel (kişi başına sayfa)'], ['aylik-durum', 'Excel (renkli durum tablosu)']]) {
    const definition = REPORTS.find(item => item.slug === slug);
    if (!definition) throw new Error('Missing definition');
    expect(reportExportLabel('excel', definition)).toBe(label);
  }
  expect(reportExportLabel('csv', report)).toBe('CSV');
});
