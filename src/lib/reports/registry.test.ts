import { describe, expect, it } from 'vitest';
import { REPORTS, getReport, reportColumns, reportsInGroup } from './registry';
import { isReportGroupKey } from './groups';
import { dailyCell, dailySource, monthlySheet } from './testFixtures';
import { buildMonthlyStatusRows, flattenDailyRows } from './rows';
describe('report registry', () => {
  it('contains eighteen unique reports in valid groups with labelled unique columns', () => {
    expect(REPORTS).toHaveLength(18);
    expect(new Set(REPORTS.map(report => report.slug)).size).toBe(18);
    for (const report of REPORTS) {
      expect(isReportGroupKey(report.group)).toBe(true);
      expect(report.columns.every(column => column.label.trim())).toBe(true);
      expect(new Set(report.columns.map(column => column.key)).size).toBe(report.columns.length);
      expect(getReport(report.group, report.slug)).toBe(report);
      expect(report.formats).toEqual(['excel', 'csv', 'pdf']);
    }
    expect(reportsInGroup('gunluk')).toHaveLength(9);
    expect(reportsInGroup('kayitlar').map(report => report.slug)).toEqual(['ham-okutmalar', 'okutma-karti', 'mobil-okutmalar']);
    expect(reportsInGroup('aylik')).toHaveLength(6);
    expect(reportsInGroup('resmi')).toEqual([]);
    expect(getReport('aylik', 'ham-okutmalar')).toBeUndefined();
  });
  it('uses minute cells only for the monthly duration matrix and no days for summaries', () => {
    const sheet = monthlySheet();
    sheet.days.push('2026-10-20');
    for (const report of reportsInGroup('aylik')) {
      const columns = reportColumns(report, sheet.days);
      const day = columns.find(column => column.key === 'day:19');
      if (report.slug === 'aylik-calisma-suresi') {
        const row = buildMonthlyStatusRows(sheet)[0];
        expect(day?.value(row)).toBe('8:55');
        expect(columns.find(column => column.key === 'day:20')?.value(row)).toBe('—');
      }
      if (!report.monthlyDays) expect(columns.some(column => column.key.startsWith('day:'))).toBe(false);
    }
    const department = getReport('aylik', 'departman-bazli-devam');
    expect(department?.filters).not.toContain('person');
    expect(department?.pinnedColumns).toEqual(['department']);
    expect(getReport('kayitlar', 'okutma-karti')?.pinnedColumns).toEqual(['date', 'name']);
  });
  it('puts the monthly day matrix between identities and totals', () => {
    const def = getReport('aylik', 'aylik-durum');
    if (!def) throw new Error('Missing monthly definition');
    const sheet = monthlySheet(); const columns = reportColumns(def, sheet.days);
    expect(columns.map(column => column.key).slice(0, 5)).toEqual(['name', 'department', 'payrollCode', 'day:19', 'duration']);
    expect(columns.find(column => column.key === 'day:19')?.value(buildMonthlyStatusRows(sheet)[0])).toBe('N');
  });
});

it('defines focused break columns with numeric export minutes', () => {
  const report = getReport('gunluk', 'mola');
  expect(report?.title).toBe('Mola');
  expect(report?.filters).toContain('breakViolation');
  expect(getReport('gunluk', 'mola-ihlalleri')).toBeUndefined();
  expect(report?.columns.filter(column => column.defaultVisible).map(column => column.label)).toEqual(['Tarih', 'Ad Soyad', 'Departman', 'Vardiya', 'Plan mola', 'Mola kayıtları', 'Mola süresi', 'İhlal']);
  const cell = dailyCell();
  if (!cell.detail) throw new Error('Missing detail');
  cell.detail = { ...cell.detail, breaks: [{ start: '12:02', end: '12:48', minutes: 46 }, { start: '15:10', end: '15:25', minutes: 15 }], breakMinutes: 61, breakViolation: true };
  const row = flattenDailyRows([dailySource([cell])])[0];
  expect(report?.columns.find(column => column.key === 'breaks')?.value(row)).toBe('12:02–12:48 · 15:10–15:25');
  expect(report?.columns.find(column => column.key === 'breakMinutes')?.value(row)).toBe('1 sa 01 dk');
  expect(report?.columns.find(column => column.key === 'breakMinutes')?.minutesValue?.(row)).toBe(61);
  expect(report?.columns.find(column => column.key === 'breakViolation')?.value(row)).toBe('Plan molada okutma yok');
});

it('registers monthly person summaries with independent Excel layouts', () => {
  for (const [slug, layout] of [['aylik-ozet', 'personBlocks'], ['kisi-devam-dokumu', 'personSheets']]) {
    const definition = getReport('aylik', slug);
    expect(definition).toMatchObject({ dataSource: 'pdksMatrix', includePunches: true, rowsMode: 'personMonth', excelLayout: layout, filters: ['month', 'department', 'person'] });
    expect(definition?.columns).toHaveLength(17);
    expect(definition?.columns.filter(column => column.minutesValue).map(column => column.key)).toEqual(['duration', 'overtime', 'breakMinutes', 'shortfallMinutes', 'excessMinutes']);
    // Esnek sütunları seçilebilir ama varsayılan kapalı; sabit projede boş sütun görünmez.
    expect(definition?.columns.filter(column => !column.defaultVisible).map(column => column.key)).toEqual(['shortfallMinutes', 'excessMinutes']);
    expect(definition?.columns.some(column => column.key === 'date')).toBe(false);
  }
  expect(getReport('aylik', 'aylik-durum')?.excelLayout).toBe('statusMatrix');
});

it('offers the optional early-exit day total only on monthly matrices sharing MONTHLY_TOTALS', () => {
  const sheet = monthlySheet();
  const cell = sheet.rows[0]?.cells[0];
  if (!cell) throw new Error('Missing fixture');
  cell.isEarlyExit = true;
  const row = buildMonthlyStatusRows(sheet)[0];
  for (const slug of ['aylik-durum', 'aylik-calisma-suresi']) {
    const def = getReport('aylik', slug);
    if (!def) throw new Error('Missing report');
    const column = reportColumns(def, sheet.days).find(item => item.key === 'earlyExitDays');
    expect(column).toMatchObject({ label: 'Erken çıkış (gün)', defaultVisible: false });
    expect(column?.value(row)).toBe(1);
  }
  expect(getReport('gunluk', 'gunluk-puantaj')?.columns.some(column => column.key === 'earlyExitDays')).toBe(false);
  expect(getReport('aylik', 'kisi-bazli-devam')?.columns.filter(column => column.key === 'earlyExitDays')).toHaveLength(1);
});
