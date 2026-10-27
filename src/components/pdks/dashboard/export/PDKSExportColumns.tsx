import { NativeSelect } from "@/components/ui/native-select";
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { availablePDKSColumns, defaultPDKSPreferences, movePDKSColumn, selectedPDKSColumns, togglePDKSColumn, type PDKSExportPreferences } from '@/lib/pdksExportColumns';
import type { PDKSExportRecord } from '@/utils/pdksExport';

export interface PDKSExportColumnsProps {
  records: readonly PDKSExportRecord[];
  preferences: PDKSExportPreferences;
  canSeePay: boolean;
  disabled?: boolean;
  onChange: (next: PDKSExportPreferences) => void;
}
export function PDKSExportColumns({ records, preferences, canSeePay, disabled, onChange }: PDKSExportColumnsProps) {
  const columns = availablePDKSColumns(canSeePay);
  const selected = selectedPDKSColumns(preferences.orderedColumnKeys, canSeePay);
  const changeKeys = (orderedColumnKeys: string[]) => onChange({ ...preferences, orderedColumnKeys });
  return <section className="min-w-0 space-y-3" aria-label="Kolonlar">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Kolonlar</h3>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange({ ...defaultPDKSPreferences(canSeePay), format: preferences.format })}>Varsayılana dön</Button>
    </div>
    <p className="text-xs text-muted-foreground">En az bir kolon seçin. Kart no ve bordro kodu tercihleri her açılışta varsayılana döner.</p>
    <div className="space-y-1">
      {[...selected, ...columns.filter(c => !selected.some(item => item.key === c.key))].map(c => {
        const index = preferences.orderedColumnKeys.indexOf(c.key);
        const checked = index >= 0;
        return <div key={c.key} className="flex items-center gap-2 rounded-md border px-2 py-1">
          <Checkbox id={`pdks-export-${c.key}`} checked={checked} disabled={disabled || (checked && selected.length === 1)} onCheckedChange={() => changeKeys(togglePDKSColumn(preferences.orderedColumnKeys, c.key))} />
          <label className="flex-1 text-sm" htmlFor={`pdks-export-${c.key}`}>{c.label}</label>
          {checked && <>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${c.label} yukarı`} disabled={disabled || index === 0} onClick={() => changeKeys(movePDKSColumn(preferences.orderedColumnKeys, c.key, -1))}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${c.label} aşağı`} disabled={disabled || index === selected.length - 1} onClick={() => changeKeys(movePDKSColumn(preferences.orderedColumnKeys, c.key, 1))}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
          </>}
        </div>;
      })}
    </div>
    {preferences.format === 'CSV' && <label className="flex items-center gap-2 text-sm">CSV ayracı
      <NativeSelect className="w-auto" value={preferences.delimiter} disabled={disabled} onChange={event => {
        const delimiter = event.target.value;
        if (delimiter === ',' || delimiter === ';' || delimiter === '\t') onChange({ ...preferences, delimiter });
      }}><option value=",">Virgül (,)</option><option value=";">Noktalı virgül (;)</option><option value={'\t'}>TAB (sekme)</option></NativeSelect>
    </label>}
    <h3 className="text-sm font-medium">Önizleme (ilk 5 satır)</h3>
    <div className="max-w-full overflow-x-auto rounded-md border">
      <Table aria-label="Dışa aktarma önizlemesi">
        <TableHeader><TableRow>{selected.map(c => <TableHead scope="col" key={c.key} className="whitespace-nowrap">{c.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{records.slice(0, 5).map((row, index) => <TableRow key={`${row.id}-${index}`}>{selected.map(c => <TableCell key={c.key} className="whitespace-nowrap">{c.value(row)}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  </section>;
}
