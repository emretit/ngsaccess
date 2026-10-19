import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PDF_MAX_ROWS, PDF_ROW_LIMIT_MESSAGE } from '@/lib/reports/export';
import { ReportPage } from './ReportPage';
import { ReportResults } from './ReportResults';
import type { Id } from '../../../convex/_generated/dataModel';
import { toggleHiddenColumn } from '@/lib/reports/columns';
import { dailyCell, dailySource, transactionPage } from '@/lib/reports/testFixtures';
import { flattenDailyRows } from '@/lib/reports/rows';
import { REPORTS, type ReportDefinition } from '@/lib/reports/registry';
import Reports from '@/pages/Reports';
const mocks = vi.hoisted(() => ({ role: 'project_user', query: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { role: mocks.role } }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ loading: false, projectId: null }) }));
vi.mock('convex/react', () => ({ useQuery: mocks.query }));
const definition: ReportDefinition = { slug: 'example', group: 'gunluk', title: 'Örnek rapor', description: 'Örnek', dataSource: 'pdksMatrix', filters: [], formats: ['csv'], columns: [
  { key: 'name', label: 'Ad Soyad', defaultVisible: true, value: row => row.kind === 'daily' ? row.name : null },
  { key: 'department', label: 'Departman', defaultVisible: true, value: row => row.kind === 'daily' ? row.department : null },
] };
afterEach(() => { vi.unstubAllGlobals(); mocks.role = 'project_user'; mocks.query.mockReset(); });
describe('generic report display', () => {
  it('honors saved column hiding for both the header and data', () => {
    const hidden = toggleHiddenColumn([], 'department');
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(hidden) });
    const html = renderToStaticMarkup(<ReportPage definition={definition} rows={flattenDailyRows([dailySource([dailyCell()])])} meta={{ from: '2026-10-19', to: '2026-10-19' }} />);
    expect(html).toContain('scope="col"'); expect(html).toContain('Ayşe Yılmaz'); expect(html).not.toContain('Üretim'); expect(html).not.toContain('>Departman</th>');
    expect(toggleHiddenColumn(hidden, 'department')).toEqual([]);
  });
  it('can reveal a column that is hidden by default and ignores malformed storage', () => {
    const custom = { ...definition, columns: definition.columns.map(column => column.key === 'department' ? { ...column, defaultVisible: false } : column) };
    const rows = flattenDailyRows([dailySource([dailyCell()])]);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(toggleHiddenColumn([], 'department', false)) });
    expect(renderToStaticMarkup(<ReportPage definition={custom} rows={rows} meta={{ from: '2026-10-19', to: '2026-10-19' }} />)).toContain('Üretim');
    vi.stubGlobal('localStorage', { getItem: () => 'not-json' });
    expect(renderToStaticMarkup(<ReportPage definition={custom} rows={rows} meta={{ from: '2026-10-19', to: '2026-10-19' }} />)).not.toContain('Üretim');
  });
  it('provides an actionable empty state and a disabled export control', () => {
    const html = renderToStaticMarkup(<ReportPage definition={definition} rows={[]} meta={{ from: '2026-10-19', to: '2026-10-19' }} />);
    expect(html).toContain('Kayıt bulunamadı'); expect(html).toContain('Filtreleri değiştirebilirsiniz.'); expect(html).toContain('disabled=""');
  });
  it('explains the PDF limit while keeping Excel available', () => {
    const source = flattenDailyRows([dailySource([dailyCell()])])[0];
    const rows = Array.from({ length: PDF_MAX_ROWS + 1 }, (_, i) => ({ ...source, id: String(i) }));
    const html = renderToStaticMarkup(<ReportPage definition={{ ...definition, formats: ['excel', 'pdf'] }} rows={rows} meta={{ from: '2026-10-01', to: '2026-10-31' }} />);
    expect(html).toContain(PDF_ROW_LIMIT_MESSAGE);
    expect(html).toContain('Dışa aktar');
    expect(renderToStaticMarkup(<ReportPage definition={{ ...definition, formats: ['pdf'] }} rows={rows.slice(0, PDF_MAX_ROWS)} meta={{ from: '2026-10-01', to: '2026-10-31' }} />)).not.toContain(PDF_ROW_LIMIT_MESSAGE);
  });
  it('clarifies that hidden biometric totals include records outside client filters', () => {
    const transactions = REPORTS.find(report => report.dataSource === 'transactions');
    if (!transactions) throw new Error('Missing transaction report');
    mocks.query.mockReturnValue(transactionPage('reading', 12));
    const html = renderToStaticMarkup(<ReportResults definition={transactions} projectId={'project-a' as Id<'projects'>} from="2026-10-01" to="2026-10-31" person="Mehmet" year={2026} month={10} />);
    expect(html).toContain('Yüklenen sayfalarda 12 biyometrik kayıt gizlendi (kişi/departman filtresinden bağımsız).');
    expect(html).toContain('Filtreye uyan 0');
    expect(html).not.toContain('Ayşe Yılmaz');
  });
  it('renders only 50 rows on the first page', () => {
    const source = flattenDailyRows([dailySource([dailyCell()])])[0];
    const rows = Array.from({ length: 51 }, (_, i) => ({ ...source, id: String(i), name: `Kişi-${i}` }));
    const html = renderToStaticMarkup(<ReportPage definition={definition} rows={rows} meta={{ from: '2026-10-19', to: '2026-10-19' }} />);
    expect(html).toContain('Kişi-49'); expect(html).not.toContain('Kişi-50'); expect(html).toContain('1 / 2');
  });
});
function route(path: string) { return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Routes><Route path="/reports/:group?/:slug?" element={<Reports />} /></Routes></MemoryRouter>); }
describe('report routes', () => {
  it('renders the four groups and six reports in the hub', () => { const html = route('/reports'); expect(html).toContain('Kayıtlar'); expect(html).toContain('Resmi'); expect(html).toContain('Ham Okutmalar'); expect(html).toContain('Aylık Durum'); });
  it('provides recovery for unknown groups, mismatched slugs and official slugs', () => { for (const path of ['/reports/invalid', '/reports/gunluk/ham-okutmalar', '/reports/resmi/sgk']) expect(route(path)).toContain('Rapor bulunamadı'); });
  it('gates official settings links and skips all queries when no project is selected', () => {
    expect(route('/reports/resmi')).toContain('Bu raporlar yöneticiler içindir.'); mocks.role = 'project_admin';
    expect(route('/reports/resmi')).toContain('/settings?tab=reports');
    expect(route('/reports/gunluk/gunluk-puantaj')).toContain('Bir proje seçin'); expect(mocks.query).not.toHaveBeenCalled();
  });
});
