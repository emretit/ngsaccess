import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Id } from '../../../../convex/_generated/dataModel';
import { AssignmentPatternEditor } from '../AssignmentPatternEditor';
import { bulkAssignmentFormSchema, type BulkAssignmentFormValues } from '../assignmentFormSchema';
import { assignmentFields, bulkAssignmentRequest, departmentAssignmentRequest, planPreview, withPlan } from './planForm';
import { DEFAULT_WORKING_DAYS, type Shift } from './planning';

const shiftId = 'shift' as Id<'shifts'>;
const projectId = 'project' as Id<'projects'>;
const shift = { _id: shiftId, projectId, name: 'Gündüz', startTime: '09:00', endTime: '17:00' } as Shift;
const values: BulkAssignmentFormValues = { employeeIds: ['person'], shiftId, startDate: '2026-10-19', endDate: '2026-11-01', weekPattern: [...DEFAULT_WORKING_DAYS] };

describe('Haftalık çalışma günleri', () => {
  it('gün kutuları sürekli görünür; önizlemedeki hafta sonları hafta tatilidir', () => {
    const html = renderToStaticMarkup(<AssignmentPatternEditor values={values} shifts={[shift]} onChange={() => {}} />);
    expect(html.match(/type="checkbox"/g)).toHaveLength(7);
    expect(html.match(/checked=""/g)).toHaveLength(5);
    expect(html).toContain('Seçilmeyen günler hafta tatili sayılır.');
    expect(html).not.toContain('Belirli günler');
    expect(html).not.toContain('Her gün uygulanır');
    expect(html).toContain('24.10.2026, Hafta tatili');
    expect(planPreview(values).filter(day => day.shiftIds?.length)).toHaveLength(10);
    expect(planPreview(values).filter(day => day.shiftIds?.length === 0)).toHaveLength(4);
  });
  it.each([undefined, { kind: 'weekly', shiftIds: [shiftId] }] as const)('boş haftalık gün seçimi alan hatası verir (%j)', plan => {
    const result = bulkAssignmentFormSchema.safeParse({ ...values, plan, weekPattern: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual([expect.objectContaining({ path: ['weekPattern'], message: 'En az bir çalışma günü seçin.' })]);
  });
  it('kişi ve departman aynı günleri gönderir; yedi gün seçimi de açık taşınır', () => {
    const person = bulkAssignmentRequest(values, projectId, false, false);
    const department = departmentAssignmentRequest({ ...values, departmentId: 'department' }, projectId, false);
    expect(person.weekPattern).toEqual(DEFAULT_WORKING_DAYS);
    expect(department.weekPattern).toEqual(person.weekPattern);
    expect(person).not.toHaveProperty('specificDays');
    expect(assignmentFields({ ...values, weekPattern: [...DEFAULT_WORKING_DAYS, 'SAT', 'SUN'] }).weekPattern).toHaveLength(7);
  });
  it('döngüye gün kısıtı göndermez; haftalığa dönüşte boş günler Pzt–Cum olur', () => {
    const cycle = withPlan(values, { kind: 'dayCycle', anchorDate: values.startDate, slots: [[shiftId], []] });
    expect(assignmentFields(cycle).weekPattern).toBeUndefined();
    expect(bulkAssignmentFormSchema.safeParse({ ...cycle, weekPattern: [] }).success).toBe(true);
    expect(withPlan({ ...cycle, weekPattern: [] }, { kind: 'weekly', shiftIds: [shiftId] }).weekPattern).toEqual(DEFAULT_WORKING_DAYS);
  });
});
