import { useRef, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { Employee } from './lib/planning';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-picker';
import { errorMessage, notify } from '@/lib/notify';
export function ClearAssignmentsDialog({ projectId, employees, initialIds, start, end, onClose }: {
  projectId: Id<'projects'>; employees: Employee[]; initialIds: string[]; start: string; end: string; onClose: () => void;
}) {
  const convex = useConvex();
  const apply = useMutation(api.shifts.clearAssignments);
  const [selected, setSelected] = useState(new Set(initialIds));
  const [search, setSearch] = useState('');
  const [startDate, setStart] = useState(start);
  const [endDate, setEnd] = useState(end);
  const [preview, setPreview] = useState<FunctionReturnType<typeof api.shifts.previewClearAssignments> | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const args = { projectId, employeeIds: employees.filter(e => selected.has(e._id)).map(e => e._id), startDate, endDate };
  const run = async (confirm: boolean) => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      if (confirm && preview) { const result = await apply(args); notify.success(`${result.affectedEmployees} çalışanın atamaları temizlendi`); onClose(); }
      else setPreview(await convex.query(api.shifts.previewClearAssignments, args));
    } catch (error: unknown) { setError(errorMessage(error)); setPreview(null); }
    finally { lock.current = false; setPending(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Toplu temizle</DialogTitle><DialogDescription>Seçili çalışanların tarih aralığındaki atamalarını kaldırın. Aralığın dışındaki günler korunur.</DialogDescription></DialogHeader>
    <label className="space-y-1 text-sm">Çalışan ara<Input value={search} onChange={event => setSearch(event.target.value)} /></label>
    <div className="max-h-48 overflow-auto rounded border p-2">{employees.filter(e => `${e.firstName} ${e.lastName}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))).map(e => <label key={e._id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" disabled={pending} checked={selected.has(e._id)} onChange={() => { setSelected(old => { const next = new Set(old); if (next.has(e._id)) next.delete(e._id); else next.add(e._id); return next; }); setPreview(null); }} />{e.firstName} {e.lastName}</label>)}</div>
    <p className="text-sm">{selected.size} çalışan seçildi · En fazla 500</p>
    <div className="flex flex-wrap gap-3"><label className="text-sm">Başlangıç<DateInput disabled={pending} value={startDate} onChange={value => { setStart(value); setPreview(null); }} /></label><label className="text-sm">Bitiş<DateInput disabled={pending} value={endDate} onChange={value => { setEnd(value); setPreview(null); }} /></label></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview && <div role="status" className="space-y-2 text-sm"><p>{preview.deleted} silinecek, {preview.trimmed} kırpılacak, {preview.split} bölünecek · {preview.affectedEmployees} çalışan.</p>{preview.affectsPast && <p className="text-destructive">Geçmiş günlerin PDKS hesabı değişir.</p>}</div>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={onClose}>Vazgeç</Button><Button variant={preview ? 'destructive' : 'default'} disabled={pending || !selected.size || (preview !== null && !preview.affectedEmployees)} onClick={() => run(preview !== null)}>{pending ? 'İşleniyor…' : preview ? 'Onayla ve temizle' : 'Önizle'}</Button></div>
  </DialogContent></Dialog>;
}
