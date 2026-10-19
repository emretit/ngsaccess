import { getDateRange, PRESET_LABELS, type PresetKey } from '@/lib/pdksDateRanges';
import { parseDateString, toLocalDateString, todayInTurkey } from '@/lib/date';

export const REPORT_PRESETS = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'last-month', 'custom'] as const;
export type ReportPreset = typeof REPORT_PRESETS[number];
export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = { ...PRESET_LABELS, custom: 'Özel' };
export interface ReportPeriod { preset: ReportPreset; from: string; to: string }
export function reportPreset(value: string | null): ReportPreset {
  return REPORT_PRESETS.find(key => key === value) ?? 'today';
}
/** Anchor calendar calculations to the Turkish day, independent of the browser's timezone. */
export function presetPeriod(preset: ReportPreset, today = todayInTurkey()): ReportPeriod {
  const anchor = parseDateString(today) ?? new Date(2000, 0, 1);
  const range = getDateRange((preset === 'custom' ? 'today' : preset) as PresetKey, anchor);
  return { preset, from: toLocalDateString(range.from), to: toLocalDateString(range.to) };
}
export function periodFromParams(params: URLSearchParams, today = todayInTurkey()): ReportPeriod {
  const preset = reportPreset(params.get('preset'));
  const range = presetPeriod(preset, today);
  return preset === 'custom' ? { preset, from: params.get('from') ?? range.from, to: params.get('to') ?? range.to } : range;
}
export function periodError(from: string, to: string, maxDays = 31): string | undefined {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return 'Geçerli bir başlangıç ve bitiş tarihi girin.';
  if (from > to) return 'Başlangıç tarihi bitiş tarihinden sonra olamaz.';
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1 > maxDays) return `En fazla ${maxDays} günlük bir dönem seçin.`;
}
export function monthPeriod(value: string): { year: number; month: number; from: string; to: string } | undefined {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
  const [year, month] = value.split('-').map(Number);
  if (year < 1000 || year > 9999) return;
  return { year, month, from: `${value}-01`, to: `${value}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
}
