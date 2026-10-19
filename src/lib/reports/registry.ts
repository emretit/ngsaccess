import { STATUS_META } from '@/components/pdks/statusMeta';
import { type ReportGroupKey } from './groups';
import { formatDailyExceptions, formatMinutes, formatPunches, formatReportDate, formatShortMinutes, formatTransactionTime, type AttendanceCounts, type DailyReportRow, type DepartmentReportRow, type MonthlyReportRow, type MonthlyRowMode, type ReportRow, type TransactionReportRow } from './rows';

export type ReportFormat = 'csv' | 'excel' | 'pdf';
export interface ReportColumn {
  key: string; label: string; value: (row: ReportRow) => string | number | null;
  align?: 'left' | 'right' | 'center'; defaultVisible: boolean; exportOnly?: boolean;
}
export interface ReportDefinition {
  slug: string; group: ReportGroupKey; title: string; description: string;
  dataSource: 'pdksMatrix' | 'monthlyPayroll' | 'transactions';
  pinnedColumns?: readonly string[];
  includePunches?: boolean;
  monthlyDays?: 'code' | 'minutes'; monthlyRows?: MonthlyRowMode;
  transactionSources?: readonly ('card' | 'pin' | 'qr' | 'mobile' | 'manual' | 'unknown')[];
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
function department(key: string, label: string, value: (row: DepartmentReportRow) => string | number | null): ReportColumn {
  return { key, label, value: row => row.kind === 'department' ? value(row) : null, defaultVisible: true };
}
function attendance(key: keyof AttendanceCounts, label: string): ReportColumn {
  return { key, label, value: row => row.kind === 'monthly' || row.kind === 'department' ? row.attendance[key] : null, defaultVisible: true, align: 'right' };
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
const ATTENDANCE_COUNTS = [attendance('workedDays', 'Çalışılan gün'), attendance('holidayWorkedDays', 'Tatilde çalışma (gün)'), attendance('lateDays', 'Geç (gün)'), attendance('earlyExitDays', 'Erken çıkış (gün)'), attendance('absentDays', 'Devamsız'), attendance('leaveDays', 'İzinli')];
const PUNCHES = daily('punches', 'Okutmalar', row => formatPunches(row.cell) || null);
const dailyColumns = (...keys: string[]): ReportColumn[] => keys.flatMap(key => DAILY_COLUMNS.filter(column => column.key === key));
const FORMATS: readonly ReportFormat[] = ['excel', 'csv', 'pdf'];
const dailyReport = (slug: string, title: string, description: string): ReportDefinition => ({ slug, group: 'gunluk', title, description, dataSource: 'pdksMatrix', pinnedColumns: ['date', 'name'], columns: DAILY_COLUMNS, filters: ['period', 'department', 'person'], formats: FORMATS });
const TRANSACTIONS: ReportDefinition = { slug: 'ham-okutmalar', group: 'kayitlar', title: 'Ham Okutmalar', description: 'Geçiş kayıtlarını zaman, cihaz ve sonuç bilgisiyle inceleyin.', dataSource: 'transactions', pinnedColumns: ['time', 'name'], filters: ['period', 'department', 'person', 'result'], formats: FORMATS, columns: [
    transaction('time', 'Zaman (İstanbul)', row => formatTransactionTime(row.accessTime)), transaction('name', 'Ad Soyad', row => row.employeeName), transaction('department', 'Departman', row => row.department),
    transaction('cardNo', 'Kart no', row => row.cardNo), transaction('device', 'Cihaz', row => row.deviceName), transaction('door', 'Kapı', row => row.doorName),
    transaction('direction', 'Yön', row => ({ entry: 'Giriş', exit: 'Çıkış', unknown: 'Bilinmiyor' })[row.direction]),
    transaction('result', 'Sonuç / Ret nedeni', row => `${({ granted: 'İzin verildi', denied: 'Reddedildi', unknown: 'Bilinmiyor' })[row.result]}${row.denialReason ? ` · ${row.denialReason}` : ''}`),
    transaction('source', 'Kaynak', row => row.sourceLabel),
  ] };
export const REPORTS: readonly ReportDefinition[] = [
  TRANSACTIONS,
  { ...dailyReport('okutma-karti', 'Günlük Okutma Kartı', 'Günün okutmaları ve çalışma süreleri.'), group: 'kayitlar', includePunches: true, columns: [...dailyColumns('date', 'name', 'department'), PUNCHES, ...dailyColumns('firstEntry', 'lastExit', 'duration', 'readingCount')] },
  { ...TRANSACTIONS, slug: 'mobil-okutmalar', title: 'Mobil Okutmalar', description: 'Mobil ve QR kaynaklı geçiş kayıtları.', transactionSources: ['mobile', 'qr'] },
  dailyReport('gunluk-puantaj', 'Günlük Puantaj', 'Planlanan ve gerçekleşen çalışma saatlerini kişi ve gün bazında karşılaştırın.'),
  dailyReport('gec-kalanlar', 'Geç Kalanlar', 'Geç kalma süresine göre sıralanan günlük kayıtlar.'),
  dailyReport('devamsizlar', 'Devamsızlar', 'Seçili dönemde devamsızlık görünen kişi ve günler.'),
  { ...dailyReport('fazla-mesai', 'Fazla Mesai', 'Gün türüyle birlikte fazla çalışma süreleri.'), columns: [...DAILY_COLUMNS, daily('dayType', 'Gün türü', row => row.cell.detail ? DAY_TYPES[row.cell.detail.dayType] : null)] },
  { ...dailyReport('calisma-suresi', 'Çalışma Süresi', 'Çalışma süresi bulunan günlerin giriş, çıkış ve fazla mesai bilgileri.'), columns: dailyColumns('date', 'name', 'department', 'shift', 'firstEntry', 'lastExit', 'duration', 'overtime') },
  { ...dailyReport('ilk-giris-son-cikis', 'İlk Giriş / Son Çıkış', 'Planlanan saatlerle günün ilk giriş ve son çıkışını karşılaştırın.'), columns: dailyColumns('date', 'name', 'department', 'plannedStart', 'firstEntry', 'plannedEnd', 'lastExit', 'readingCount') },
  { ...dailyReport('istisnalar', 'İstisnalar', 'Geç kalma, erken çıkış ve devamsızlık görünen günler.'), columns: [...DAILY_COLUMNS, daily('exception', 'İstisna', row => formatDailyExceptions(row.cell))] },
  dailyReport('erken-cikanlar', 'Erken Çıkanlar', 'Erken çıkış süresine göre sıralanan günlük kayıtlar.'),
  { ...dailyReport('mola-ihlalleri', 'Mola İhlalleri', 'Vardiyada tanımlı mola aralığında hiç okutma olmayan ve 7,5 saatten uzun süren günler.'), includePunches: true, columns: [...dailyColumns('date', 'name', 'department', 'shift'), daily('plannedBreak', 'Plan mola', row => row.cell.detail?.plannedBreakStart && row.cell.detail.plannedBreakEnd ? `${row.cell.detail.plannedBreakStart}–${row.cell.detail.plannedBreakEnd}` : null), ...dailyColumns('firstEntry', 'lastExit', 'duration'), PUNCHES] },
  { slug: 'aylik-durum', group: 'aylik', title: 'Aylık Durum', description: 'Ayın günlerini durum kodları ve kişi toplamlarıyla inceleyin.', dataSource: 'monthlyPayroll', monthlyDays: 'code', pinnedColumns: ['name'], columns: [...MONTHLY_IDENTITY, ...MONTHLY_TOTALS], filters: ['month', 'department', 'person'], formats: FORMATS },
  { slug: 'aylik-calisma-suresi', group: 'aylik', title: 'Aylık Çalışma Süresi', description: 'Günlük çalışma sürelerini ayın günleri ve kişi toplamlarıyla inceleyin.', dataSource: 'monthlyPayroll', monthlyDays: 'minutes', pinnedColumns: ['name'], columns: [...MONTHLY_IDENTITY, ...MONTHLY_TOTALS], filters: ['month', 'department', 'person'], formats: FORMATS },
  { slug: 'kisi-bazli-devam', group: 'aylik', title: 'Kişi Bazlı Devam', description: 'Kişi başına devam, devamsızlık ve çalışma süresi toplamları.', dataSource: 'monthlyPayroll', pinnedColumns: ['name'], columns: [...MONTHLY_IDENTITY, ...ATTENDANCE_COUNTS, attendance('weekendDays', 'Hafta tatili'), attendance('holidayDays', 'Resmî tatil'), ...MONTHLY_TOTALS.slice(0, 2)], filters: ['month', 'department', 'person'], formats: FORMATS },
  { slug: 'departman-bazli-devam', group: 'aylik', title: 'Departman Bazlı Devam', description: 'Departmanların kişi, devam ve çalışma süresi toplamları.', dataSource: 'monthlyPayroll', monthlyRows: 'departments', pinnedColumns: ['department'], columns: [department('department', 'Departman', row => row.department), department('personCount', 'Kişi sayısı', row => row.personCount), ...ATTENDANCE_COUNTS.map(column => column.key === 'workedDays' ? { ...column, label: 'Çalışılan kişi-gün' } : column), department('duration', 'Toplam süre', row => formatMinutes(row.totalMinutes)), department('overtime', 'Fazla mesai', row => formatMinutes(row.overtimeMinutes)), department('attendanceRate', 'Devam oranı (%)', row => row.attendanceRate === null ? null : row.attendanceRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 }))], filters: ['month', 'department'], formats: FORMATS },
];
export function getReport(group: ReportGroupKey, slug: string): ReportDefinition | undefined { return REPORTS.find(report => report.group === group && report.slug === slug); }
export function reportsInGroup(group: ReportGroupKey): ReportDefinition[] { return REPORTS.filter(report => report.group === group); }
export function reportColumns(def: ReportDefinition, days: readonly string[] = []): readonly ReportColumn[] {
  if (!def.monthlyDays) return def.columns;
  const dayColumns = days.map(day => monthly(`day:${day.slice(-2)}`, formatReportDate(day), row => {
    const cell = row.cells.find(item => item.date === day);
    return def.monthlyDays === 'minutes' ? formatShortMinutes(cell?.totalMinutes ?? 0) : cell?.payrollCode ?? null;
  }, 'center'));
  return [...def.columns.slice(0, MONTHLY_IDENTITY.length), ...dayColumns, ...def.columns.slice(MONTHLY_IDENTITY.length)];
}
export function visibleReportColumns(columns: readonly ReportColumn[], keys: readonly string[]): ReportColumn[] { return columns.filter(column => keys.includes(column.key)); }
