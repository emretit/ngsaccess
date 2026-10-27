vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Reports from '@/pages/Reports';
import { ReportPage } from './ReportPage';
import { ReportScreen } from './ReportScreen';
import { REPORTS, reportColumns } from '@/lib/reports/registry';
import { monthlySheet, dailyCell, dailySource } from '@/lib/reports/testFixtures';
import { buildMonthlyStatusRows, flattenDailyRows, departmentLabel } from '@/lib/reports/rows';
import { excelReportColumns } from '@/lib/reports/export';
import { readHiddenColumns, saveHiddenColumns, columnStorageKey } from '@/lib/reports/columns';
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { _id: 'user-a', role: 'project_admin' } }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ projectId: 'project-a', activeProject: { name: 'Proje' }, loading: false }) }));
vi.mock('convex/react', () => ({ useQuery: () => [], useConvex: () => ({ query: async () => [] }) }));
const meta = { from: '2026-10-01', to: '2026-10-31' };
function report(slug: string) { const value = REPORTS.find(item => item.slug === slug); if (!value) throw new Error(slug); return value; }
describe('reports audit fixes', () => {
  it('renders separate official deep links and 44px group links', () => {
    const route = (path: string) => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Routes><Route path="/reports/:group?" element={<Reports />} /></Routes></MemoryRouter>);
    for (const key of ['sgk', 'overtime', 'dept-cost']) expect(route('/reports/resmi')).toContain(`/settings?tab=reports&amp;report=${key}`);
    expect(route('/reports')).toContain('flex min-h-11 items-center gap-2 text-base');
  });
  it('keeps person identity sticky and short date headings accessible', () => {
    const definition = report('aylik-durum'); const sheet = monthlySheet();
    const html = renderToStaticMarkup(<ReportPage definition={definition} rows={buildMonthlyStatusRows(sheet)} days={sheet.days} meta={meta} />);
    expect(html).toContain('sticky left-0 z-20 bg-surface'); expect(html).toContain('sticky left-0 z-10 bg-surface');
    expect(html).toContain('aria-label="19.10.2026"'); expect(html).toContain('>19</th>');
  });
  it('distinguishes zero duration from unavailable and future days in both monthly matrices', () => {
    const sheet = monthlySheet(); const row = sheet.rows[0]; const cell = row.cells[0];
    for (const slug of ['aylik-durum', 'aylik-calisma-suresi']) {
      for (const status of ['future', 'noData'] as const) {
        cell.status = status; cell.payrollCode = '—';
        expect(reportColumns(report(slug), sheet.days).find(column => column.key.startsWith('day:'))?.value(buildMonthlyStatusRows(sheet)[0])).toBe('—');
      }
    }
    cell.status = 'absent'; cell.totalMinutes = 0;
    expect(reportColumns(report('aylik-calisma-suresi'), sheet.days).find(column => column.key.startsWith('day:'))?.value(buildMonthlyStatusRows(sheet)[0])).toBe('0:00');
    expect(flattenDailyRows([dailySource([dailyCell({ status: 'noData' })])])).toEqual([]);
  });
  it('normalizes missing departments in every report column and export', () => {
    for (const value of [null, undefined, '-', '—', 'Belirtilmemiş', '']) expect(departmentLabel(value)).toBe('Departmansız');
    const row = flattenDailyRows([dailySource([dailyCell()])])[0]; row.department = '-';
    expect(report('gec-kalanlar').columns.find(column => column.key === 'department')?.value(row)).toBe('Departmansız');
  });
  it('shows focused lateness columns while keeping other columns selectable', () => {
    const columns = report('gec-kalanlar').columns;
    expect(columns.filter(column => column.defaultVisible).map(column => column.key)).toEqual(['date', 'name', 'department', 'plannedStart', 'firstEntry', 'lateMinutes']);
    expect(columns.find(column => column.key === 'manual')?.defaultVisible).toBe(false);
    for (const slug of ['devamsizlar', 'erken-cikanlar', 'istisnalar', 'fazla-mesai']) expect(report(slug).columns.filter(column => column.defaultVisible).length).toBeLessThan(10);
  });
  it('provides report-specific empty messages and clear action', () => {
    for (const [slug, title] of [['devamsizlar', 'devamsız kişi'], ['erken-cikanlar', 'erken çıkan kişi'], ['mola', 'mola kaydı']]) {
      const html = renderToStaticMarkup(<ReportPage definition={report(slug)} rows={[]} onClear={() => {}} meta={meta} />);
      expect(html).toContain(title); expect(html).toContain('Filtreleri temizle');
    }
  });
  it('collapses mobile filters, uses date pickers and displays a single range error', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/?preset=custom&from=2026-10-20&to=2026-10-01']}><ReportScreen definition={report('gec-kalanlar')} /></MemoryRouter>);
    const controls = html.match(/<button[^>]*aria-expanded="false" aria-controls="([^"]+)"[^>]*>Filtreler<\/button>/)?.[1];
    expect(controls).toBeTruthy(); expect(html).toContain(`id="${controls}" class="hidden md:block"`);
    expect(html).toContain('Başlangıç tarihi bitiş tarihinden sonra olamaz.'); expect(html).not.toContain('Dönem seçimini düzeltin.');
    expect(html).toMatch(/<button[^>]*id="report-from"/); expect(html).toContain('20 Ekim 2026'); expect(html).not.toContain('GG.AA.YYYY');
  });
  it('adds numeric minutes to Excel and scopes saved columns to project and user', () => {
    const row = flattenDailyRows([dailySource([dailyCell()])])[0];
    const columns = excelReportColumns(report('calisma-suresi').columns);
    expect(columns.find(column => column.key === 'duration:minutes')?.value(row)).toBe(row.cell.totalMinutes);
    expect(columns.find(column => column.key === 'overtime:minutes')?.value(row)).toBe(row.cell.overtimeMinutes);
    const values = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    const scope = { projectId: 'a', userId: 'u' }; saveHiddenColumns('report', ['name'], scope);
    expect(readHiddenColumns('report', scope)).toEqual(['name']); expect(readHiddenColumns('report', { ...scope, userId: 'other' })).toEqual([]); expect(readHiddenColumns('report', { ...scope, projectId: 'b' })).toEqual([]);
    expect(columnStorageKey('report', scope)).toBe('reports.columns.a.u.report'); vi.unstubAllGlobals();
  });
});

it('shows the break filter and enables clearing a URL-only violation selection', () => {
  const definition = REPORTS.find(item => item.slug === 'mola');
  if (!definition) throw new Error('Missing break report');
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/?ihlal=1']}><ReportScreen definition={definition} /></MemoryRouter>);
  expect(html).toContain('id="report-break"');
  expect(html).toContain('for="report-break"');
  expect(html).toMatch(/<button(?![^>]* disabled=)[^>]*>Filtreleri temizle<\/button>/);
});
