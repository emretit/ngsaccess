import { STATUS_META } from '@/components/pdks/statusMeta';
import { type ReportGroupKey } from './groups';
import { formatMinutes, formatReportDate, formatTransactionTime, type DailyReportRow, type MonthlyReportRow, type ReportRow, type TransactionReportRow } from './rows';

export type ReportFormat = 'csv' | 'excel' | 'pdf';
export interface ReportColumn {
  key: string; label: string; value: (row: ReportRow) => string | number | null;
  align?: 'left' | 'right' | 'center'; defaultVisible: boolean; exportOnly?: boolean;
}
export interface ReportDefinition {
  slug: string; group: ReportGroupKey; title: string; description: string;
  dataSource: 'pdksMatrix' | 'monthlyPayroll' | 'transactions';
  pinnedColumns?: readonly string[];
  columns: readonly ReportColumn[]; filters: readonly ('period' | 'department' | 'person' | 'result' | 'month')[]; formats: readonly ReportFormat[];
}
function daily(key: string, label: string, value: (row: DailyReportRow) => string | number | null, align?: ReportColumn['align']): ReportColumn {
  return { key, label, value: row => row.kind === 'daily' ? value(row) : null, defaultVisible: true, align };
}
function monthly(key: string, label: string, value: (row: MonthlyReportRow) => string | number | null, align?: ReportColumn['align']): ReportColumn {
  return { key, label, value: row => row.kind === 'monthly' ? value(row) : null, defaultVisible: true, align };
}
function transaction(key: string, label: string, value: (row: TransactionReportRow['transaction']) => string | number | null): ReportColumn {
  return { key, label, value: row => row.kind === 'transaction' ? value(row.transaction) : null, defaultVisible: true };
}
export const DAILY_COLUMNS: readonly ReportColumn[] = [
  daily('date', 'Tarih', row => formatReportDate(row.cell.date)),
  daily('name', 'Ad Soyad', row => row.name), daily('department', 'Departman', row => row.department), daily('payrollCode', 'Bordro kodu', row => row.payrollCode),
  daily('shift', 'Vardiya', row => row.cell.detail?.shiftName ?? null),
  daily('plannedStart', 'Plan giriş', row => row.cell.detail?.plannedStart ?? null), daily('plannedEnd', 'Plan çıkış', row => row.cell.detail?.plannedEnd ?? null),
  daily('firstEntry', 'İlk giriş', row => row.cell.firstEntry), daily('lastExit', 'Son çıkış', row => row.cell.lastExit),
  daily('duration', 'Toplam süre', row => formatMinutes(row.cell.totalMinutes)), daily('lateMinutes', 'Geç (dk)', row => row.cell.lateMinutes, 'right'),
  daily('earlyExitMinutes', 'Erken çıkış (dk)', row => row.cell.detail?.earlyExitMinutes ?? null, 'right'),
  daily('overtime', 'Fazla mesai', row => formatMinutes(row.cell.overtimeMinutes)), daily('status', 'Durum', row => STATUS_META[row.cell.status].label),
  daily('readingCount', 'Okutma sayısı', row => row.cell.detail?.readingCount ?? null, 'right'), daily('manual', 'Manuel', row => row.cell.detail ? row.cell.detail.isManual ? 'Evet' : 'Hayır' : null),
];
const DAY_TYPES = { workday: 'Hafta içi', weekend: 'Hafta sonu', holiday: 'Resmî tatil', halfDayHoliday: 'Yarım gün' };
const MONTHLY_IDENTITY = [monthly('name', 'Ad Soyad', row => row.name), monthly('department', 'Departman', row => row.department), monthly('payrollCode', 'Bordro kodu', row => row.payrollCode)];
const MONTHLY_TOTALS = [
  monthly('duration', 'Toplam süre', row => formatMinutes(row.totals.totalMinutes)), monthly('overtime', 'Fazla mesai', row => formatMinutes(row.totals.overtimeMinutes)),
  monthly('leaveDays', 'İzin (gün)', row => row.totals.leaveDays, 'right'), monthly('absentDays', 'Devamsız (gün)', row => row.totals.absentDays, 'right'), monthly('lateDays', 'Geç (gün)', row => row.totals.lateDays, 'right'),
];
const FORMATS: readonly ReportFormat[] = ['excel', 'csv', 'pdf'];
const dailyReport = (slug: string, title: string, description: string): ReportDefinition => ({ slug, group: 'gunluk', title, description, dataSource: 'pdksMatrix', pinnedColumns: ['date', 'name'], columns: DAILY_COLUMNS, filters: ['period', 'department', 'person'], formats: FORMATS });
export const REPORTS: readonly ReportDefinition[] = [
  { slug: 'ham-okutmalar', group: 'kayitlar', title: 'Ham Okutmalar', description: 'Geçiş kayıtlarını zaman, cihaz ve sonuç bilgisiyle inceleyin.', dataSource: 'transactions', pinnedColumns: ['time', 'name'], filters: ['period', 'department', 'person', 'result'], formats: FORMATS, columns: [
    transaction('time', 'Zaman (İstanbul)', row => formatTransactionTime(row.accessTime)), transaction('name', 'Ad Soyad', row => row.employeeName), transaction('department', 'Departman', row => row.department),
    transaction('cardNo', 'Kart no', row => row.cardNo), transaction('device', 'Cihaz', row => row.deviceName), transaction('door', 'Kapı', row => row.doorName),
    transaction('direction', 'Yön', row => ({ entry: 'Giriş', exit: 'Çıkış', unknown: 'Bilinmiyor' })[row.direction]),
    transaction('result', 'Sonuç / Ret nedeni', row => `${({ granted: 'İzin verildi', denied: 'Reddedildi', unknown: 'Bilinmiyor' })[row.result]}${row.denialReason ? ` · ${row.denialReason}` : ''}`),
    transaction('source', 'Kaynak', row => row.sourceLabel),
  ] },
  dailyReport('gunluk-puantaj', 'Günlük Puantaj', 'Planlanan ve gerçekleşen çalışma saatlerini kişi ve gün bazında karşılaştırın.'),
  dailyReport('gec-kalanlar', 'Geç Kalanlar', 'Geç kalma süresine göre sıralanan günlük kayıtlar.'),
  dailyReport('devamsizlar', 'Devamsızlar', 'Seçili dönemde devamsızlık görünen kişi ve günler.'),
  { ...dailyReport('fazla-mesai', 'Fazla Mesai', 'Gün türüyle birlikte fazla çalışma süreleri.'), columns: [...DAILY_COLUMNS, daily('dayType', 'Gün türü', row => row.cell.detail ? DAY_TYPES[row.cell.detail.dayType] : null)] },
  { slug: 'aylik-durum', group: 'aylik', title: 'Aylık Durum', description: 'Ayın günlerini durum kodları ve kişi toplamlarıyla inceleyin.', dataSource: 'monthlyPayroll', pinnedColumns: ['name'], columns: [...MONTHLY_IDENTITY, ...MONTHLY_TOTALS], filters: ['month', 'department', 'person'], formats: FORMATS },
];
export function getReport(group: ReportGroupKey, slug: string): ReportDefinition | undefined { return REPORTS.find(report => report.group === group && report.slug === slug); }
export function reportsInGroup(group: ReportGroupKey): ReportDefinition[] { return REPORTS.filter(report => report.group === group); }
export function reportColumns(def: ReportDefinition, days: readonly string[] = []): readonly ReportColumn[] {
  return def.dataSource === 'monthlyPayroll' ? [...MONTHLY_IDENTITY, ...days.map(day => monthly(`day:${day.slice(-2)}`, formatReportDate(day), row => row.cells.find(cell => cell.date === day)?.payrollCode ?? null, 'center')), ...MONTHLY_TOTALS] : def.columns;
}
export function visibleReportColumns(columns: readonly ReportColumn[], keys: readonly string[]): ReportColumn[] { return columns.filter(column => keys.includes(column.key)); }
