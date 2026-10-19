import { CalendarIcon } from 'lucide-react';
import { formatTrDate } from '@/lib/date';
import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { AUDIT_TARGET_LABELS } from '../../../convex/lib/auditLogQuery';
import { FilterBar } from '@/components/shared/FilterBar';
import { QuerySectionBoundary } from '@/components/shared/QuerySectionBoundary';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { actionLabels, type AuditArgs } from './auditState';
import type { useAuditUrlState } from './useAuditUrlState';
import { DateInput } from '@/components/ui/date-picker';

function ActorFilter({ args, value, onChange }: { args: AuditArgs; value: string; onChange: (value: string) => void }) {
  // Seçenek taraması ağır (2000 olay) ve her yeni kayıtta yeniden çalışır: yalnız seçici açılınca veya seçili aktör varken yükle.
  const [wanted, setWanted] = useState(Boolean(value) && value !== 'system');
  const options = useQuery(api.auditLog.actorOptions, (wanted || Boolean(value && value !== 'system')) ? { projectId: args.projectId, allProjects: args.allProjects } : 'skip');
  const statuses = { active: 'Kayıtları yapan kişi', member: 'Proje üyesi', deleted: 'Silinmiş kullanıcı', removed: 'Mevcut üye listesinde yok' };
  return <div className="min-w-0 space-y-1">
    <label id="audit-user-label" className="text-xs text-muted-foreground">Kullanıcı</label>
    <Select value={value || 'all'} onValueChange={onChange} onOpenChange={open => { if (open) setWanted(true); }}>
      <SelectTrigger aria-labelledby="audit-user-label" className="w-full"><SelectValue placeholder="Kullanıcılar yükleniyor…" /></SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-32px)]"><SelectItem value="all">{options || !wanted ? 'Tüm kullanıcılar' : 'Kullanıcılar yükleniyor…'}</SelectItem>
        <SelectItem value="system">Sistem</SelectItem>
        {value && value !== 'system' && (!options || !options.actors.some(actor => actor.userId === value)) && <SelectItem value={value}>{options ? 'Seçili aktör · Seçenek listesinde bulunamadı' : 'Seçili aktör yükleniyor…'}</SelectItem>}
        {options?.actors.map(actor => <SelectItem key={actor.userId} value={actor.userId}><span className="block [overflow-wrap:anywhere]">{actor.label}<span className="block text-xs text-muted-foreground">{statuses[actor.status]}</span></span></SelectItem>)}
      </SelectContent>
    </Select>
    {options?.truncated && <p className="text-xs text-muted-foreground">Seçenekler sınırlı sayıdaki son kayıttan ve mevcut üyelerden derlendi; eski aktörler veya bazı üyeler listede olmayabilir.{!options.includesSystem && ' Eski Sistem kayıtları bu seçenek taramasına dahil olmayabilir.'}</p>}
  </div>;
}

export function AuditFilters({ state, args, ready, rangeError }: { state: ReturnType<typeof useAuditUrlState>; args: AuditArgs; ready: boolean; rangeError?: string }) {
  const [open, setOpen] = useState(false);
  const count = ['user', 'action', 'target', 'start', 'end'].filter(key => state.params.get(key)).length;
  return <div className="min-w-0 space-y-3 border-b pb-4">
    <FilterBar search={state.search} onSearchChange={value => state.setSearch(value.slice(0, 500))} searchLabel="Denetim kayıtlarında ara" placeholder="Kullanıcı, varlık veya not ara" onClear={state.clear} hasFilters={count > 0}>
      <Button variant="outline" className="md:hidden" aria-expanded={open} aria-controls="audit-advanced" onClick={() => setOpen(!open)}>Filtreler{count ? ` (${count})` : ''}</Button>
      <div id="audit-advanced" className={`${open || rangeError ? 'grid' : 'hidden'} w-full min-w-0 gap-3 md:contents`}>
        <div className="grid min-w-0 gap-3 md:flex-1 md:grid-cols-3">
          {ready ? <QuerySectionBoundary resetKey={`${args.projectId}-${args.allProjects}`} title="Kullanıcı seçenekleri yüklenemedi" description="Yeniden deneyebilirsiniz."><ActorFilter args={args} value={state.params.get('user') || ''} onChange={value => state.update('user', value)} /></QuerySectionBoundary> : <div className="text-sm text-muted-foreground">Kullanıcıları görmek için bir proje seçin.</div>}
          <div className="min-w-0 space-y-1"><label id="audit-action-label" className="text-xs text-muted-foreground">Eylem</label><Select value={args.action || 'all'} onValueChange={value => state.update('action', value)}><SelectTrigger aria-labelledby="audit-action-label"><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-32px)]"><SelectItem value="all">Tüm eylemler</SelectItem>{Object.entries(actionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="min-w-0 space-y-1"><label id="audit-target-label" className="text-xs text-muted-foreground">Varlık</label><Select value={args.targetTable || 'all'} onValueChange={value => state.update('target', value)}><SelectTrigger aria-labelledby="audit-target-label"><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-32px)]"><SelectItem value="all">Tüm varlıklar</SelectItem>{Object.entries(AUDIT_TARGET_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="hidden w-full md:block" aria-hidden="true" /><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:w-[420px]">{[['start', 'Başlangıç'], ['end', 'Bitiş']].map(([key, label]) => { const value = state.params.get(key) || ''; const display = value && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? formatTrDate(new Date(`${value}T12:00:00Z`)) : 'Tarih seçin'; return <div key={key} className="min-w-0 space-y-1"><label htmlFor={`audit-${key}`} className="text-xs text-muted-foreground">{label}</label><DateInput id={`audit-${key}`} className="min-w-0 w-full" value={value} trigger={<Button id={`audit-${key}`} type="button" variant="outline" className="h-9 w-full justify-between text-xs font-normal" aria-label={`${label}: ${display}`} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'audit-range-error' : undefined}>{display}<CalendarIcon aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>} onChange={value => state.update(key, value)} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'audit-range-error' : undefined} /></div>; })}</div>
      </div>
    </FilterBar>
    {rangeError && <p id="audit-range-error" role="alert" className="w-full text-sm text-destructive">{rangeError}</p>}
    <p className="text-xs text-muted-foreground">Arama: kullanıcı, varlık etiketi, not ve kaydedilmiş ad/unvan alanları.</p>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer focus-visible:outline focus-visible:outline-ring">Arama kapsamı</summary><p className="mt-2 max-w-3xl">Eski arama metni bulunmayan kayıtlar metin aramasına dahil edilmez; geçmişi incelemek için aramayı temizleyin. Kimlik, kart, TC, telefon ve tüm JSON alanlarında arama yapılmaz. Kayıtların arama metni en çok 500 karakterdir.{args.search && (args.startDate || args.endDate) && ' Aramada tarih aralığı yüklenen sonuçlara uygulanır; eşleşme görmüyorsanız daha fazla yükleyin.'}</p></details>
  </div>;
}
