import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { auditScopeHandoff, auditScopeParams, clearAuditFilters } from './auditState';

export function useAuditUrlState(scope: string, ready: boolean) {
  const [params, setParams] = useSearchParams();
  const searchUrl = params.get('q') ?? '';
  const [search, setSearch] = useState(searchUrl);
  const debounced = useDebouncedValue(search, 300);
  const synced = useRef(searchUrl);
  const [previousScope, setPreviousScope] = useState<string | undefined>(() => auditScopeHandoff.read() ?? (ready ? scope : undefined));
  useEffect(() => auditScopeHandoff.hold(previousScope), [previousScope]);
  const changingScope = previousScope !== undefined && previousScope !== scope;
  useEffect(() => {
    if (!ready) return;
    if (previousScope === undefined) { setPreviousScope(scope); return; }
    if (previousScope !== scope) {
      if (params.has('user')) {
        setParams(current => auditScopeParams(current, previousScope, scope), { replace: true });
      } else setPreviousScope(scope);
    }
  }, [scope, ready, previousScope, params, setParams]);
  useEffect(() => {
    if (synced.current !== searchUrl) { synced.current = searchUrl; setSearch(searchUrl); return; }
    if (search !== debounced || searchUrl === debounced) return;
    synced.current = debounced;
    setParams(current => { const next = new URLSearchParams(current); if (debounced) next.set('q', debounced); else next.delete('q'); return next; }, { replace: true });
  }, [searchUrl, search, debounced, setParams]);
  function update(key: string, value: string) {
    setParams(current => {
      const next = new URLSearchParams(current);
      if (!value || value === 'all') next.delete(key); else next.set(key, value);
      if (key === 'allProjects') next.delete('user');
      return next;
    }, { replace: true });
  }
  function clear() { setSearch(''); setParams(clearAuditFilters, { replace: true }); }
  return { params, search, setSearch, update, clear, changingScope };
}
