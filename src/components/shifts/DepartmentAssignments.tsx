import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { ConfirmDestructive } from '@/components/shared/ConfirmDestructive';
import { usePermissions } from '@/hooks/usePermissions';
import { onRowActivate, ROW_CLICK_CLASS } from '@/lib/tableRowClick';
import { notify } from '@/lib/notify';
import { departmentPath } from '@/components/employees/lib/departmentPath';
import { departmentLabels } from '@/lib/departmentLabel';
import { AssignmentEditDialog } from './AssignmentEditDialog';
import { planSummary } from './lib/planForm';
import { shortDate, type DepartmentAssignment } from './lib/planning';

export function DepartmentAssignments({ projectId }: { projectId: Id<'projects'> }) {
  const assignments = useQuery(api.shiftPlans.listDepartmentAssignments, { projectId });
  const departments = useQuery(api.departments.list, { projectId });
  const companies = useQuery(api.companies.list, { projectId });
  const shifts = useQuery(api.shifts.list, { projectId });
  const remove = useMutation(api.shiftPlans.removeDepartmentAssignment);
  const { can } = usePermissions();
  const [edit, setEdit] = useState<DepartmentAssignment | null>(null);
  const [deleting, setDeleting] = useState<DepartmentAssignment | null>(null);
  const labels = departmentLabels(departments, companies, item => departmentPath(item._id, departments ?? []));
  const name = (row: DepartmentAssignment) => labels.get(row.departmentId) ?? departmentPath(row.departmentId, departments ?? []);
  return <section className="mt-6 space-y-3 border-t pt-4" aria-label="Departman atamaları">
    <h3 className="font-semibold">Departman atamaları</h3>
    {!assignments || !departments || !shifts ? <SectionSkeleton label="Departman atamaları yükleniyor" /> : !assignments.length ? <p className="text-sm text-muted-foreground">Henüz departman ataması yok.</p> : <div className="overflow-x-auto"><Table resizeKey="shift-department-assignments" className="w-full text-sm">
      <TableHeader><TableRow className="border-b text-left"><TableHead columnId="department" className="p-2">Departman</TableHead><TableHead columnId="pattern" className="p-2">Desen</TableHead><TableHead columnId="date-range" className="p-2">Tarih aralığı</TableHead><TableHead columnId="actions" resizable={false} resizeLabel="İşlemler" className="p-2"><span className="sr-only">İşlemler</span></TableHead></TableRow></TableHeader>
      <TableBody>{assignments.map(row => <TableRow key={row._id} className={`border-b ${can('schedule.manage') ? ROW_CLICK_CLASS : ''}`} onClick={can('schedule.manage') ? onRowActivate(() => setEdit(row)) : undefined}>
        <TableCell className="p-2 truncate" title={name(row)}>{name(row)}</TableCell><TableCell className="p-2 truncate" title={planSummary(row.plan)}>{planSummary(row.plan)}</TableCell><TableCell className="p-2 whitespace-nowrap">{shortDate(row.startDate)}–{shortDate(row.endDate)}</TableCell>
        <TableCell className="p-2">{can('schedule.manage') && <div className="flex gap-1"><Button variant="ghost" onClick={() => setEdit(row)} aria-label={`${name(row)} atamasını düzenle`}>Düzenle</Button><Button variant="ghost" onClick={() => setDeleting(row)} aria-label={`${name(row)} atamasını sil`}>Sil</Button></div>}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>}
    <AssignmentEditDialog open={Boolean(edit)} onOpenChange={open => { if (!open) setEdit(null); }} assignment={edit} shifts={shifts ?? []} employeeName={edit ? name(edit) : ''} shiftName={shifts?.find(s => s._id === edit?.shiftId)?.name ?? 'Vardiya'} />
    <ConfirmDestructive open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null); }} title="Departman ataması silinsin mi?" objectName={deleting ? `${name(deleting)} · ${shortDate(deleting.startDate)}–${shortDate(deleting.endDate)}` : ''} effects={['Bu departman ve alt departmanların tüm seri planı kaldırılır. Kişisel atamalar korunur.']} confirmLabel="Atamayı sil" onConfirm={async () => { if (!deleting) return; await remove({ departmentAssignmentId: deleting._id }); notify.success('Departman ataması silindi'); setDeleting(null); }} />
  </section>;
}
