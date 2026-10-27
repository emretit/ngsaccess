import { PlanQueryBoundary } from "./PlanQueryBoundary";
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { departmentPath } from '@/components/employees/lib/departmentPath';
import { departmentLabels } from '@/lib/departmentLabel';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { ShiftSelect } from './ShiftSelect';
import { Button } from '@/components/ui/button';
import type { BulkAssignmentFormValues } from './assignmentFormSchema';
import { assignmentFields } from './lib/planForm';
import { shortDate } from './lib/planning';

type DepartmentPreview = FunctionReturnType<typeof api.shiftPlans.previewDepartmentAssign>;
export function departmentPreviewSummary(preview: DepartmentPreview) {
  return `Alt departmanlar da alır · ${preview.employeeCount} kişi · ${preview.personalOverrideCount} kişide kişisel atama öncelikli`;
}
export function DepartmentTargetPicker({ projectId, value, onChange, error, previewValues }: { projectId: Id<'projects'>; value: string; onChange: (value: string) => void; error?: string; previewValues?: BulkAssignmentFormValues }) {
  const departments = useQuery(api.departments.list, { projectId });
  const companies = useQuery(api.companies.list, { projectId });
  if (!departments) return <SectionSkeleton label="Departmanlar yükleniyor" />;
  const labels = departmentLabels(departments, companies, item => departmentPath(item._id, departments));
  return <div className="space-y-2">
    <ShiftSelect label="Departman" value={value} onChange={onChange} placeholder="Departman seçin" invalid={Boolean(error)} describedBy={error ? 'assignment-department-error' : undefined}
      options={departments.map(item => ({ value: item._id, label: labels.get(item._id) ?? item.name })).sort((a, b) => a.label.localeCompare(b.label, 'tr'))} />
    {previewValues ? <PlanQueryBoundary resetKey={JSON.stringify(previewValues)}><DepartmentLiveSummary projectId={projectId} values={previewValues} /></PlanQueryBoundary> : <p className="text-xs text-muted-foreground">Alt departmanlar da alır. Kişisel atamalar önceliklidir.</p>}
    {error && <p id="assignment-department-error" role="alert" className="text-xs text-danger">{error}</p>}
  </div>;
}
export function DepartmentPreviewPanel({ values, projectId, forceConfirm, setForceConfirm, pending, onSave }: {
  values: BulkAssignmentFormValues; projectId: Id<'projects'>; forceConfirm: boolean; setForceConfirm: (value: boolean) => void; pending: boolean; onSave: () => void;
}) {
  const preview = useQuery(api.shiftPlans.previewDepartmentAssign, { projectId, departmentId: values.departmentId as Id<'departments'>, ...assignmentFields(values) });
  if (!preview) return <SectionSkeleton label="Departman önizlemesi hesaplanıyor" />;
  return <section className="space-y-3 border-t pt-3">
    <h3 className="font-medium">3. Önizleme</h3>
    <p role="status" className="text-sm">{departmentPreviewSummary(preview)}</p>
    <p className="text-sm">{preview.leaveCount} izin günü · {preview.holidayCount} tatil günü</p>
    {preview.sameDepartmentConflicts.length > 0 && <>
      <ul className="text-xs">{preview.sameDepartmentConflicts.map(row => <li key={row.departmentAssignmentId}>{row.shiftName} · {shortDate(row.startDate)}–{shortDate(row.endDate)}</li>)}</ul>
      <label className="flex gap-2 text-sm"><input type="checkbox" className="size-6 shrink-0 accent-primary" checked={forceConfirm} disabled={pending} onChange={e => setForceConfirm(e.target.checked)} />Aynı departmandaki çakışmalara rağmen atamayı onaylıyorum.</label>
    </>}
    <Button type="button" disabled={pending || (preview.sameDepartmentConflicts.length > 0 && !forceConfirm)} onClick={onSave}>{pending ? 'Atanıyor…' : 'Departmana uygula'}</Button>
  </section>;
}

function DepartmentLiveSummary({ projectId, values }: { projectId: Id<'projects'>; values: BulkAssignmentFormValues }) {
  const preview = useQuery(api.shiftPlans.previewDepartmentAssign, { projectId, departmentId: values.departmentId as Id<'departments'>, ...assignmentFields(values) });
  return <p role="status" className="text-xs text-muted-foreground">{preview ? departmentPreviewSummary(preview) : 'Departman kapsamı hesaplanıyor…'}</p>;
}
