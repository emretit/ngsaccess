import { useEffect, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { formatReportDate } from '@/lib/reports/rows';
export function reportDateValue(text: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}
export function ReportDateInput({ value, onChange, ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatReportDate(value) : value);
  useEffect(() => { setText(value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatReportDate(value) : value); }, [value]);
  return <Input {...props} type="text" inputMode="numeric" placeholder="GG.AA.YYYY" value={text} onChange={event => { const next = event.target.value; setText(next); onChange(reportDateValue(next)); }} />;
}
