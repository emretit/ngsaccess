import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import { DepartmentTargetPicker } from './DepartmentTargetPicker';

const state = vi.hoisted(() => ({ change: undefined as ((value: string) => void) | undefined }));
vi.mock('convex/react', () => ({ useQuery: () => [{ _id: 'department', name: 'Üretim' }, { _id: 'another', name: 'Depo' }] }));
// Render the boundary in its failed state; only its children are replaced by the error.
vi.mock('./PlanQueryBoundary', () => ({ PlanQueryBoundary: (_props: { children: ReactNode }) => <p role="alert">Planın vardiya bilgisi bulunamadı</p> }));
vi.mock('./ShiftSelect', () => ({ ShiftSelect: ({ onChange }: { onChange: (value: string) => void }) => { state.change = onChange; return <button role="combobox" aria-label="Departman">Üretim</button>; } }));

it('a failed live summary leaves the department selector visible and changeable', () => {
  const onChange = vi.fn();
  const html = renderToStaticMarkup(<DepartmentTargetPicker projectId={'project' as Id<'projects'>} value="department" onChange={onChange}
    previewValues={{ target: 'department', departmentId: 'department', employeeIds: [], shiftId: 'shift', startDate: '2026-10-19', endDate: '2026-10-20', specificDays: false, weekPattern: [] }} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain('role="combobox" aria-label="Departman"');
  state.change?.('another');
  expect(onChange).toHaveBeenCalledWith('another');
});
