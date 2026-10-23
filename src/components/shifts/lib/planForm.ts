import type { RefObject } from "react";
import type { Id } from '../../../../convex/_generated/dataModel';
import { MAX_DAY_CYCLE, MAX_WEEK_CYCLE, slotForDate, validateDayShifts, validateShiftPlan, validPlanDate, type ShiftPlan } from '../../../../convex/lib/shiftPlan';
import type { BulkAssignmentFormValues } from '../assignmentFormSchema';
import { offsetDay, type Shift } from './planning';
import { shiftError } from './shiftError';

export function buildRotation(parts: { shiftIds: Id<'shifts'>[]; days: number }[]) {
  return parts.flatMap(part => Array.from({ length: Math.max(0, Math.min(MAX_DAY_CYCLE, Math.floor(part.days))) }, () => [...part.shiftIds])).slice(0, MAX_DAY_CYCLE);
}
export function resizeRotation(slots: Id<'shifts'>[][], count: number, kind: 'dayCycle' | 'weekCycle') {
  const length = Math.max(1, Math.min(kind === 'dayCycle' ? MAX_DAY_CYCLE : MAX_WEEK_CYCLE, Math.floor(count) || 1)) * (kind === 'weekCycle' ? 7 : 1);
  return Array.from({ length }, (_, i) => [...(slots[i] ?? [])]);
}
export function mondayOf(date: string) {
  return validPlanDate(date) ? offsetDay(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)) : date;
}
export function dayShiftsError(ids: string[], shifts: Shift[]) {
  try {
    const selected = ids.map(id => shifts.find(shift => shift._id === id));
    if (selected.some(shift => !shift)) return 'Vardiya seçin';
    validateDayShifts(selected.filter((shift): shift is Shift => shift !== undefined));
    return '';
  } catch (error) { return shiftError(error).message; }
}
export function planFormError(values: BulkAssignmentFormValues, shifts: Shift[]) {
  try {
    validateShiftPlan({ ...assignmentFields(values), projectId: shifts.find(shift => shift._id === values.shiftId)?.projectId }, new Map(shifts.map(shift => [shift._id, shift])));
    return '';
  } catch (error) { return shiftError(error).message; }
}
/** Omit plan entirely for legacy single-shift writes; updates to stored plans explicitly carry it. */
export function assignmentFields(values: BulkAssignmentFormValues, storedPlan = false) {
  const plan = values.plan;
  const cycle = plan && plan.kind !== 'weekly';
  return {
    shiftId: values.shiftId as Id<'shifts'>,
    startDate: values.startDate,
    endDate: values.endDate,
    weekPattern: cycle ? undefined : values.specificDays ? values.weekPattern : undefined,
    ...(plan ? { plan } : storedPlan ? { plan: { kind: 'weekly' as const, shiftIds: [values.shiftId as Id<'shifts'>] } } : {}),
  };
}
export function withPlan(values: BulkAssignmentFormValues, plan: ShiftPlan): BulkAssignmentFormValues {
  const shiftId = plan.kind === 'weekly' ? plan.shiftIds[0] : plan.slots.find(slot => slot.length)?.[0];
  return { ...values, shiftId: shiftId ?? '', plan: plan.kind === 'weekly' && plan.shiftIds.length === 1 ? undefined : plan,
    ...(plan.kind !== 'weekly' ? { specificDays: false, weekPattern: [] } : {}) };
}
export function planPreview(values: BulkAssignmentFormValues) {
  if (!validPlanDate(values.startDate) || (!values.shiftId && !values.plan)) return [];
  const row = { ...assignmentFields(values), endDate: offsetDay(values.startDate, 13) };
  return Array.from({ length: 14 }, (_, index) => {
    const date = offsetDay(values.startDate, index);
    return { date, shiftIds: slotForDate(row, date), outsideRange: date > values.endDate };
  });
}
export function planSummary(plan?: ShiftPlan) {
  return !plan ? 'Haftalık · 1 vardiya' : plan.kind === 'weekly' ? `Haftalık · ${plan.shiftIds.length} vardiya`
    : plan.kind === 'dayCycle' ? `${plan.slots.length} günlük döngü` : `${plan.slots.length / 7} haftalık döngü`;
}

export function bulkAssignmentRequest(values: BulkAssignmentFormValues, projectId: Id<'projects'>, forceConfirm: boolean, calendarConfirmed: boolean) {
  return { resultMode: 'detailed' as const, projectId, employeeIds: values.employeeIds as Id<'employees'>[], ...assignmentFields(values), forceConfirm, calendarConfirmed };
}

export function focusAssignmentError(planErrorRef: RefObject<Pick<HTMLElement, "focus"> | null>, hasPlanError: boolean) {
  requestAnimationFrame(() => {
    if (hasPlanError && planErrorRef.current) planErrorRef.current.focus();
    else document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

export function departmentAssignmentRequest(values: BulkAssignmentFormValues, projectId: Id<'projects'>, forceConfirm: boolean) {
  return { projectId, departmentId: values.departmentId as Id<'departments'>, ...assignmentFields(values), forceConfirm };
}
