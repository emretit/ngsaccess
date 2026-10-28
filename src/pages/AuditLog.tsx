import { AuditTable } from '@/components/audit/AuditTable';
import { AuditExportButton } from '@/components/audit/AuditExportButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useActiveProjectScope } from '@/hooks/useActiveProjectScope';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { Switch } from '@/components/ui/switch';
import { AuditCoverage } from '@/components/audit/AuditCoverage';
import { AuditFilters } from '@/components/audit/AuditFilters';
import { AuditResults } from '@/components/audit/AuditResults';
import { auditArgs, auditRangeError } from '@/components/audit/auditState';
import { useAuditUrlState } from '@/components/audit/useAuditUrlState';
import { Link, useSearchParams } from 'react-router-dom';

function AuthorizedAuditLog() {
  const { profile } = useAuth();
  const { projectId, activeProject, loading } = useActiveProjectScope();
  const [params] = useSearchParams();
  const allProjects = profile?.role === 'super_admin' && params.get('allProjects') === 'true';
  const state = useAuditUrlState(`${projectId ?? 'none'}:${allProjects}`, !loading);
  const args = auditArgs(state.params, projectId, allProjects);
  const rangeError = auditRangeError(args.startDate, args.endDate);
  const ready = !loading && (allProjects || Boolean(projectId));
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Denetim Kaydı" scope={<span>{allProjects ? 'Tüm projeler · Projesiz kayıtlar dahil' : activeProject?.name ?? 'Proje seçilmedi'} · İstanbul saati (UTC+3)</span>}>
      {profile?.role === 'super_admin' && <label className="flex min-h-10 items-center gap-2 text-sm"><Switch checked={allProjects} onCheckedChange={checked => state.update('allProjects', checked ? 'true' : '')} />Tüm projeler</label>}
    </PageHeader>
    {ready && !state.changingScope && !rangeError && <AuditExportButton key={JSON.stringify(args)} args={args} projectName={activeProject?.name ?? "proje"} />}
    <AuditCoverage />
    <AuditFilters state={state} args={args} ready={ready && !state.changingScope} rangeError={rangeError} />
    {!allProjects && <p className="text-xs text-muted-foreground">Seçili projenin kayıtları gösteriliyor. Projeyi üst çubuktan değiştirebilirsiniz.</p>}
    {loading || state.changingScope ? <AuditTable rows={[]} allProjects={allProjects} loading onSelect={() => {}} /> : !ready ? <EmptyState title="Bir proje seçin" description="Denetim kayıtlarını görmek için üst çubuktan bir proje seçin." /> : rangeError ? <AuditTable rows={[]} allProjects={allProjects} onSelect={() => {}} message={<p className="text-xs text-muted-foreground">Geçerli bir tarih aralığı seçilince kayıtlar listelenir.</p>} /> : <AuditResults key={JSON.stringify(args)} args={args} />}
  </div>;
}

export default function AuditLog() {
  const { can, loading } = usePermissions();
  if (loading) return <SectionSkeleton label="Yetkiler yükleniyor" />;
  if (!can("admin.manage")) return <div role="status" className="space-y-3 py-8"><h1 className="text-base font-semibold">Denetim kaydını görüntüleme yetkiniz yok.</h1><p className="text-sm text-muted-foreground">Bu sayfa yöneticiler içindir.</p><Button variant="outline" asChild><Link to="/">Ana Sayfa’ya dön</Link></Button></div>;
  return <AuthorizedAuditLog />;
}
