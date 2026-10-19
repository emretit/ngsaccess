import { useCallback, useEffect, useRef, useState } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { QuerySectionBoundary } from '@/components/shared/QuerySectionBoundary';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { AuditResultsContent } from './AuditResultsContent';
import { AuditDetailPanel } from './AuditDetailPanel';
import type { AuditArgs, AuditRow } from './auditState';

type Snapshot = { rows: AuditRow[]; status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'; loadMore: () => void };
// Keep the rendered snapshot outside the query boundary so a failed continuation
// cannot remove already loaded events. The parent is keyed by scope + filters.
function AuditQuery({ args, onSnapshot, onActive, hasRows }: { args: AuditArgs; onSnapshot: (snapshot: Snapshot) => void; onActive: (active: boolean) => void; hasRows: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(api.auditLog.list, args, { initialNumItems: 50 });
  useEffect(() => { onActive(true); return () => onActive(false); }, [onActive]);
  const autoLoads = useRef(0);
  const requesting = useRef(false);
  useEffect(() => {
    if (status !== 'CanLoadMore') requesting.current = false;
    const request = () => {
      if (status !== 'CanLoadMore' || requesting.current) return;
      requesting.current = true;
      loadMore(50);
    };
    onSnapshot({ rows: results, status, loadMore: request });
    if (!results.length && status === 'CanLoadMore' && autoLoads.current < 5 && !requesting.current) {
      autoLoads.current += 1;
      request();
    }
  }, [results, status, loadMore, onSnapshot]);
  return status === 'LoadingFirstPage' && !hasRows ? <SectionSkeleton label="Denetim kayıtları yükleniyor…" rows={5} /> : null;
}

export function AuditResults({ args }: { args: AuditArgs }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [active, setActive] = useState(false);
  const receive = useCallback((next: Snapshot) => setSnapshot(previous => next.status === 'LoadingFirstPage' && previous?.rows.length ? previous : next), []);
  const filtered = Boolean(args.search || args.userId || args.actor || args.action || args.targetTable || args.startDate || args.endDate);
  const rows = snapshot?.rows ?? [];
  const firstLoading = !snapshot || snapshot.status === 'LoadingFirstPage';
  const more = snapshot?.status !== 'Exhausted';
  return <div className="min-w-0 space-y-3">
    <QuerySectionBoundary title={rows.length ? 'Diğer kayıtlar yüklenemedi' : 'Denetim kayıtları yüklenemedi'} description={rows.length ? 'Yüklenen kayıtlar aşağıda korunuyor.' : 'Filtreleriniz korunuyor. Yeniden deneyebilirsiniz.'}>
      <AuditQuery args={args} onSnapshot={receive} onActive={setActive} hasRows={rows.length > 0} />
    </QuerySectionBoundary>
    {!firstLoading && <AuditResultsContent rows={rows} more={more} filtered={filtered} active={active} status={snapshot?.status} loadMore={() => snapshot?.loadMore()} args={args} onSelect={(row, trigger) => { returnFocus.current = trigger; setSelected(row); }} />}
    <AuditDetailPanel returnFocus={returnFocus} row={selected} onClose={() => setSelected(null)} />
  </div>;
}
