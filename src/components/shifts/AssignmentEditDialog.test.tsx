import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AssignmentEditDialog } from './AssignmentEditDialog';
import type { Assignment, DepartmentAssignment } from './lib/planning';
import type { BulkAssignmentFormValues } from './assignmentFormSchema';
import { DEFAULT_WORKING_DAYS } from './lib/planning';

const state = vi.hoisted(() => ({ pattern: undefined as BulkAssignmentFormValues | undefined }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('./AssignmentPatternEditor', () => ({ AssignmentPatternEditor: ({ values }: { values: BulkAssignmentFormValues }) => { state.pattern = values; return null; } }));
vi.mock('./ShiftSelect', () => ({ ShiftSelect: () => null }));
vi.mock('@/components/shared/UnsavedChangesDialog', () => ({ useUnsavedChangesGuard: () => ({ dialog: null, requestClose: vi.fn() }) }));
vi.mock('@/components/shared/ConfirmDestructive', () => ({ ConfirmDestructive: () => null }));
vi.mock('@/components/ui/dialog', () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box };
});
const assignment = { _id: 'assignment', employeeId: 'person', shiftId: 'shift', startDate: '2026-10-19', endDate: '2026-10-31' } as Assignment;
const department = { _id: 'departmentAssignment', departmentId: 'department', shiftId: 'shift', startDate: assignment.startDate, endDate: assignment.endDate } as DepartmentAssignment;

describe('Eski haftalık atama düzenlemesi', () => {
  it('plansız kişi satırı Pzt–Cum seçili açılır', () => {
    const html = renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={assignment} shifts={[]} shiftName="Gündüz" employeeName="Ada" />);
    expect(html.match(/checked=""/g)).toHaveLength(5);
    expect(html.match(/type="checkbox"/g)).toHaveLength(7);
    expect(html).not.toContain('Belirli günler');
    expect(html).toContain('Seçilmeyen günler hafta tatili sayılır.');
  });
  it.each([assignment, department])('kayıtlı boş pattern kişi ve departmanda Pzt–Cum olur ($._id)', row => {
    renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={{ ...row, weekPattern: [], plan: { kind: 'weekly', shiftIds: [row.shiftId] } }} shifts={[]} shiftName="Gündüz" employeeName="Ada" />);
    expect(state.pattern?.weekPattern).toEqual(DEFAULT_WORKING_DAYS);
    expect(state.pattern).not.toHaveProperty('specificDays');
  });
  it('kayıtlı yedi gün seçimini korur', () => {
    renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={{ ...department, weekPattern: [...DEFAULT_WORKING_DAYS, 'SAT', 'SUN'] }} shifts={[]} shiftName="Gündüz" employeeName="Ada" />);
    expect(state.pattern?.weekPattern).toHaveLength(7);
  });
});
