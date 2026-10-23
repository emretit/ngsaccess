import { useRef, useState } from 'react';
import type { Id } from '../../../convex/_generated/dataModel';
import { MAX_DAY_CYCLE, MAX_WEEK_CYCLE, type ShiftPlan } from '../../../convex/lib/shiftPlan';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { DayShiftsPicker } from './DayShiftsPicker';
import { ShiftSelect } from './ShiftSelect';
import { buildRotation, mondayOf, resizeRotation } from './lib/planForm';
import { DAYS, offsetDay, shortDate, type Shift } from './lib/planning';
import { shiftColorClasses } from './lib/shiftColors';

export function rotationNavigationIndex(index: number, length: number, key: string, control = false) {
  const next = key === 'ArrowLeft' ? index - 1 : key === 'ArrowRight' ? index + 1
    : key === 'ArrowUp' ? index - 7 : key === 'ArrowDown' ? index + 7
      : key === 'Home' ? control ? 0 : Math.floor(index / 7) * 7
        : key === 'End' ? control ? length - 1 : Math.floor(index / 7) * 7 + 6 : undefined;
  return next === undefined ? undefined : Math.max(0, Math.min(length - 1, next));
}

export function RotationLengthInput({ value, max, label, onCommit }: {
  value: number; max: number; label: string; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return <Input aria-label={label} type="number" min={1} max={max} value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={event => {
      const parsed = Number(event.currentTarget.value);
      const next = Math.max(1, Math.min(max, Number.isFinite(parsed) ? Math.floor(parsed) : 1));
      setDraft(String(next));
      onCommit(next);
    }} />;
}

type Rotation = Exclude<ShiftPlan, { kind: 'weekly' }>;
export function RotationEditor({ value, shifts, onChange }: { value: Rotation; shifts: Shift[]; onChange: (plan: Rotation) => void }) {
  const slotButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const [selected, setSelected] = useState(0);
  const [builderShift, setBuilderShift] = useState('rest');
  const [builderDays, setBuilderDays] = useState(2);
  const current = Math.min(selected, value.slots.length - 1);
  const active = shifts.filter(shift => shift.isActive !== false);
  const weekly = value.kind === 'weekCycle';
  const changeSlots = (slots: Id<'shifts'>[][]) => onChange({ ...value, slots });
  const slotLabel = (slot: Id<'shifts'>[]) => slot.map(id => shifts.find(s => s._id === id)?.name ?? 'Vardiya').join(' + ') || 'Boş';
  return <div className="space-y-3">
    <label className="block text-sm">{weekly ? 'Hafta sayısı' : 'Döngü uzunluğu'}
      <RotationLengthInput key={`${value.kind}-${value.slots.length}`} label={weekly ? 'Hafta sayısı' : 'Döngü uzunluğu'} max={weekly ? MAX_WEEK_CYCLE : MAX_DAY_CYCLE} value={value.slots.length / (weekly ? 7 : 1)}
        onCommit={count => changeSlots(resizeRotation(value.slots, count, value.kind))} />
    </label>
    <label className="block text-sm">Döngü başlangıcı<DateInput value={value.anchorDate} onChange={date => { if (date) onChange({ ...value, anchorDate: weekly ? mondayOf(date) : date }); }} /></label>
    <p className="text-xs text-muted-foreground">Döngü başlangıcı: {shortDate(value.anchorDate)}{weekly ? ' · Pazartesi' : ''}. Boş günler dinlenme günüdür.</p>
    {!weekly && <div className="space-y-2 rounded border p-2">
      <p className="text-sm font-medium">Hızlı kurucu</p>
      <div className="flex gap-2 items-center">
        <ShiftSelect label="Kurucu vardiyası" value={builderShift} onChange={setBuilderShift} options={[{ value: 'rest', label: 'Boş' }, ...active.map(s => ({ value: s._id, label: s.name }))]} />
        <span>×</span><span className="w-20"><RotationLengthInput label="Kurucu gün sayısı" max={MAX_DAY_CYCLE} value={builderDays} onCommit={setBuilderDays} /></span><span>gün</span>
      </div>
      <Button type="button" variant="outline" onClick={() => changeSlots(buildRotation([{ shiftIds: builderShift === 'rest' ? [] : [builderShift as Id<'shifts'>], days: builderDays }]))}>Döngüyü başlat</Button>{' '}
      <Button type="button" variant="outline" disabled={value.slots.length + builderDays > MAX_DAY_CYCLE} onClick={() => changeSlots([...value.slots, ...buildRotation([{ shiftIds: builderShift === 'rest' ? [] : [builderShift as Id<'shifts'>], days: builderDays }])])}>Sona ekle</Button>
      <Button type="button" variant="link" disabled={active.length < 2} onClick={() => { const morning = active[0]; const evening = active[1]; if (morning && evening) changeSlots(buildRotation([{ shiftIds: [morning._id], days: 2 }, { shiftIds: [evening._id], days: 2 }, { shiftIds: [], days: 2 }])); }}>2 sabah · 2 akşam · 2 boş</Button>
    </div>}
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 min-w-[350px]" role="group" aria-label={weekly ? 'Hafta döngüsü' : 'Gün döngüsü'}>
        {weekly && DAYS.map(([code, name]) => <span key={code} className="text-center text-xs">{name}</span>)}
        {value.slots.map((slot, index) => <button key={index} type="button" aria-pressed={current === index} tabIndex={current === index ? 0 : -1}
          ref={node => { slotButtons.current[index] = node; }}
          onKeyDown={event => {
            const next = rotationNavigationIndex(index, value.slots.length, event.key, event.ctrlKey || event.metaKey);
            if (next === undefined) return;
            event.preventDefault();
            setSelected(next);
            slotButtons.current[next]?.focus();
          }}
          aria-label={`${shortDate(offsetDay(value.anchorDate, index))}, ${slotLabel(slot)}`}
          className={`min-h-11 rounded border p-1 text-xs text-left ${current === index ? 'ring-2 ring-primary' : ''} ${slot.length ? shiftColorClasses(shifts.find(s => s._id === slot[0])?.color)?.bar ?? '' : 'bg-subtle text-muted-foreground'}`}
          onClick={() => setSelected(index)}><span className="block">{weekly ? `${Math.floor(index / 7) + 1}. hafta` : `${index + 1}. gün`}</span>{slotLabel(slot)}</button>)}
      </div>
    </div>
    <p className="text-sm font-medium">{current + 1}. gün</p>
    <DayShiftsPicker value={value.slots[current] ?? []} shifts={shifts} allowRest onChange={slot => changeSlots(value.slots.map((old, index) => index === current ? slot : old))} />
  </div>;
}
