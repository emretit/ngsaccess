import type { Ref } from "react";
import type { Id } from '../../../convex/_generated/dataModel';
import { validPlanDate, type ShiftPlan } from '../../../convex/lib/shiftPlan';
import { Button } from '@/components/ui/button';
import { DayShiftsPicker } from './DayShiftsPicker';
import { RotationEditor } from './RotationEditor';
import { WeekdaySelection } from './WeekdaySelection';
import type { BulkAssignmentFormValues } from './assignmentFormSchema';
import { mondayOf, planPreview, withPlan } from './lib/planForm';
import { istanbulToday, shortDate, type Shift } from './lib/planning';

export function AssignmentPatternEditor({ values, shifts, onChange, errors = {}, errorRef }: {
  values: BulkAssignmentFormValues; shifts: Shift[]; onChange: (values: BulkAssignmentFormValues) => void; errors?: Record<string, string>; errorRef?: Ref<HTMLParagraphElement>;
}) {
  const kind = values.plan?.kind ?? 'weekly';
  const onPlan = (plan: ShiftPlan) => onChange(withPlan(values, plan));
  const setKind = (next: ShiftPlan['kind']) => {
    const ids = values.shiftId ? [values.shiftId as Id<'shifts'>] : [];
    const anchor = validPlanDate(values.startDate) ? values.startDate : istanbulToday();
    onPlan(next === 'weekly' ? { kind: next, shiftIds: ids } : { kind: next, anchorDate: next === 'weekCycle' ? mondayOf(anchor) : anchor, slots: Array.from({ length: next === 'weekCycle' ? 7 : 1 }, () => [...ids]) });
  };
  return <section className="space-y-3" aria-label="Atama deseni">
    <h3 className="text-sm font-semibold">2. Desen</h3>
    <div role="group" aria-label="Desen" className="flex flex-wrap gap-1">
      {([['weekly', 'Haftalık'], ['dayCycle', 'Gün döngüsü'], ['weekCycle', 'Hafta döngüsü']] as const).map(([value, label]) => <Button key={value} type="button" variant={kind === value ? 'default' : 'outline'} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</Button>)}
    </div>
    {kind === 'weekly' ? <>
      <DayShiftsPicker value={values.plan?.kind === 'weekly' ? values.plan.shiftIds : values.shiftId ? [values.shiftId as Id<'shifts'>] : []} shifts={shifts} onChange={shiftIds => onPlan({ kind: 'weekly', shiftIds })} />
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" className="size-6 shrink-0 accent-primary" checked={values.specificDays} onChange={event => onChange({ ...values, specificDays: event.target.checked })} />Belirli günler</label>
      {values.specificDays ? <WeekdaySelection id="assignment-days" value={values.weekPattern} error={errors.weekPattern} onChange={weekPattern => onChange({ ...values, weekPattern })} /> : <p className="text-sm">Her gün uygulanır.</p>}
    </> : values.plan && values.plan.kind !== 'weekly' && <RotationEditor value={values.plan} shifts={shifts} onChange={onPlan} />}
    {(errors.plan || errors.shiftId) && <p ref={errorRef} tabIndex={-1} role="alert" className="text-xs text-danger">{errors.plan || errors.shiftId}</p>}
    <div className="space-y-1">
      <p className="text-xs font-medium">İlk 14 gün · Bitişten sonraki günler soluk</p>
      <div className="grid grid-cols-7 gap-1" aria-label="14 günlük önizleme">
        {planPreview(values).map(({ date, shiftIds, outsideRange }) => {
          const selected = shifts.filter(shift => shiftIds?.includes(shift._id));
          const label = shiftIds === null ? 'Uygulanmaz' : selected.map(shift => shift.name).join(' + ') || 'Boş';
          return <div key={date} aria-label={`${shortDate(date)}, ${label}`} title={`${shortDate(date)} · ${label}`} className={`rounded border p-1 text-[10px] ${outsideRange ? 'opacity-40' : ''} ${selected.length ? '' : 'bg-subtle text-muted-foreground'}`}>
            <span className="block">{shortDate(date).slice(0, 5)}</span><span className="line-clamp-2">{label}</span>
          </div>;
        })}
      </div>
    </div>
  </section>;
}
