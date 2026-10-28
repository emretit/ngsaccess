import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter';
import { AuditTable } from './AuditTable';
import type { AuditArgs, AuditRow } from './auditState';

export function AuditResultsContent({ rows, more, filtered, active, status, loadMore, args, onSelect }: {
 rows: AuditRow[]; more: boolean; filtered: boolean; active: boolean; status?: string;
 loadMore: () => void; args: AuditArgs; onSelect: (row: AuditRow, trigger: HTMLButtonElement) => void;
}) {
  return <>
      {rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p role="status" aria-live="polite">{rows.length} eşleşen kayıt yüklendi · {more ? 'Daha fazla kayıt olabilir' : 'Kapsamın sonuna ulaşıldı'}</p><span>{args.search ? 'Uygunluk sırası' : 'En yeni önce'}</span></div>}
      <AuditTable rows={rows} allProjects={args.allProjects} onSelect={onSelect} emptyTitle={more ? 'Taranan kayıtlarda eşleşme yok' : filtered ? 'Filtrelere uygun kayıt yok' : 'Henüz denetim kaydı yok'} emptyDescription={more ? 'Taranacak kayıtlar var; aramayı sürdürebilirsiniz.' : filtered ? 'Aramayı veya filtreleri değiştirin.' : 'Bu kapsamda kaydedilen olaylar burada görünür.'} />
      {(rows.length > 0 || more) && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground"><LoadMoreFooter hasMore={more} loading={active && status === 'LoadingMore'} disabled={!active || status !== 'CanLoadMore'} onLoadMore={loadMore} loadingLabel="Diğer kayıtlar yükleniyor…" summary={<p role="status" aria-live="polite">{active && status === 'LoadingMore' ? 'Diğer kayıtlar yükleniyor…' : more ? 'Daha fazla kayıt olabilir.' : 'Bu kapsamdaki tüm eşleşmeler yüklendi.'}</p>} /></div>}
  </>;
}
