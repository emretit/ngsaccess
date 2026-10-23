import { useId } from 'react';
import type { Id } from '../../../convex/_generated/dataModel';
import { MAX_SHIFTS_PER_DAY } from '../../../convex/lib/shiftPlan';
import { Button } from '@/components/ui/button';
import { ShiftSelect } from './ShiftSelect';
import { dayShiftsError } from './lib/planForm';
import { shiftTimeLabel, type Shift } from './lib/planning';

export function DayShiftsPicker({ value, shifts, onChange, allowRest = false }: {
  value: Id<'shifts'>[]; shifts: Shift[]; onChange: (ids: Id<'shifts'>[]) => void; allowRest?: boolean;
}) {
  const id = useId();
  const error = dayShiftsError(value, shifts);
  const active = shifts.filter(shift => shift.isActive !== false || value.includes(shift._id));
  const available = active.find(shift => !value.includes(shift._id));
  return <fieldset className="space-y-2" aria-describedby={error ? `${id}-error` : undefined}>
    <legend className="text-sm font-medium">Günün vardiyaları</legend>
    {!value.length && allowRest && <p className="text-sm text-muted-foreground">Boş</p>}
    {(value.length ? value : allowRest ? [] : ['']).map((selected, index) => <div key={index} className="flex items-center gap-2">
      <ShiftSelect id={`${id}-${index}`} label={`Vardiya ${index + 1}`} value={selected} placeholder="Vardiya seçin"
        options={active.filter(shift => shift._id === selected || !value.includes(shift._id)).map(shift => ({ value: shift._id, label: `${shift.name} · ${shiftTimeLabel(shift)}` }))}
        onChange={next => onChange(value.length ? value.map((item, i) => i === index ? next as Id<'shifts'> : item) : [next as Id<'shifts'>])} />
      {(allowRest || value.length > 1) && <Button type="button" variant="ghost" aria-label={`${index + 1}. vardiyayı kaldır`} onClick={() => onChange(value.filter((_, i) => i !== index))}>Kaldır</Button>}
    </div>)}
    <Button type="button" variant="outline" disabled={value.length >= MAX_SHIFTS_PER_DAY || !available} onClick={() => { if (available && value.length < MAX_SHIFTS_PER_DAY) onChange([...value, available._id]); }}>+ Vardiya ekle</Button>
    {allowRest && value.length > 0 && <Button type="button" variant="ghost" onClick={() => onChange([])}>Boş gün</Button>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
    <p className="text-xs text-muted-foreground">En fazla {MAX_SHIFTS_PER_DAY} vardiya · Aralarında en az 30 dakika.</p>
  </fieldset>;
}
