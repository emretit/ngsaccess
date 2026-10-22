import { useEffect, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { AuditArgs } from './auditState';
import { Button } from '@/components/ui/button';
import { collectAuditExport, auditExportRows } from '@/lib/auditExport';
import { downloadExport, exportFilenamePart, xlsxExport } from '@/lib/spreadsheetExport';
import { notify } from '@/lib/notify';
export function AuditExportButton({ args, projectName }: { args: AuditArgs; projectName: string }) {
  const convex = useConvex();
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setProgress(0);
    try {
      const result = await collectAuditExport(cursor => convex.query(api.auditLog.list, { ...args, paginationOpts: { cursor, numItems: 500 } }), active.signal, setProgress);
      if (result.truncated && !window.confirm('İlk 10.000 kayıt aktarılacak; tarih aralığını daraltın. Devam edilsin mi?')) return;
      active.signal.throwIfAborted();
      const blob = await xlsxExport(auditExportRows(result.rows), 'Denetim Kaydı');
      active.signal.throwIfAborted();
      downloadExport(blob, `denetim-kaydi-${exportFilenamePart(args.allProjects ? 'tum-projeler' : projectName)}-${args.startDate ?? 'ilk'}_${args.endDate ?? 'son'}.xlsx`);
    } catch (error: unknown) {
      if (!active.signal.aborted) notify.error('Denetim kaydı aktarılamadı', error);
    } finally { controller.current = null; setProgress(null); }
  };
  return <div className="flex items-center gap-2">{progress === null ? <Button variant="outline" onClick={run}>Excel'e aktar</Button> : <><span role="status" className="text-sm">{progress.toLocaleString('tr-TR')} / ~? kayıt</span><Button variant="outline" onClick={() => controller.current?.abort()}>İptal</Button></>}</div>;
}
