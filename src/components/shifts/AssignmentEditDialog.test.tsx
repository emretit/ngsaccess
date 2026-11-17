import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AssignmentEditDialog } from './AssignmentEditDialog';
import type { Assignment, DepartmentAssignment } from './lib/planning';
import { DEFAULT_WORKING_DAYS } from './lib/planning';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
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
  it('plansız kişi satırı kayıtlı günleri salt okunur gösterir', () => {
    const html = renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={assignment} shifts={[]} shiftName="Gündüz" employeeName="Ada" />);
    expect(html).not.toContain('aria-label="Çalışma günleri"');
    expect(html).toContain('Süresiz');
    expect(html).toContain("Pzt, Sal, Çar, Per, Cum");
    expect(html).not.toContain('Belirli günler');
    expect(html).not.toContain('Atama deseni');
  });
  it.each([assignment, department])('kayıtlı boş pattern kişi ve departmanda Pzt–Cum olur ($._id)', row => {
    const html = renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={{ ...row, weekPattern: [], plan: { kind: 'weekly', shiftIds: [row.shiftId] } }} shifts={[]} shiftName="Gündüz" employeeName="Ada" />);
    expect(html).toContain("Pzt, Sal, Çar, Per, Cum");
    expect(html).not.toContain("Atama deseni");
  });
  it('kayıtlı yedi gün seçimini korur', () => {
    const html = renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={{ ...department, weekPattern: [...DEFAULT_WORKING_DAYS, 'SAT', 'SUN'] }} shifts={[]} shiftName="Gündüz" employeeName="Ada" />);
    expect(html).toContain("Pzt, Sal, Çar, Per, Cum, Cmt, Paz");
  });
});
