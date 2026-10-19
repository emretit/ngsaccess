import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, FileText, FolderOpen } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { capabilities } from '@/lib/capabilities';
import { REPORT_GROUPS, REPORTS_BASE_PATH, isReportGroupKey, reportGroupPath } from '@/lib/reports/groups';
import { getReport, reportsInGroup } from '@/lib/reports/registry';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportScreen } from '@/components/reports/ReportScreen';

function MissingReport() {
  return <div className="space-y-4"><EmptyState title="Rapor bulunamadı" description="Bağlantıdaki grup veya rapor geçerli değil." /><Button asChild variant="outline"><Link to={REPORTS_BASE_PATH}>Raporlara dön</Link></Button></div>;
}
function OfficialReports() {
  const { profile } = useAuth();
  const canView = capabilities(profile?.role).settingsTabs.includes('reports');
  return <div className="space-y-5"><PageHeader title="Resmi Raporlar" scope="Ayarlar → Raporlar" />{canView ? <div className="divide-y divide-line border-y border-line">{[['sgk', 'SGK Aylık (APHB)'], ['overtime', 'Fazla Mesai Özeti'], ['dept-cost', 'Departman Maliyet']].map(([key, title]) => <Link key={key} to={`/settings?tab=reports&report=${key}`} className="flex min-h-16 items-center justify-between gap-3 px-3 py-4 text-sm font-medium hover:bg-subtle focus-visible:outline focus-visible:outline-ring">{title}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div> : <EmptyState title="Bu raporlar yöneticiler içindir." description="Günlük ve aylık raporları ilgili gruplardan inceleyebilirsiniz." />}</div>;
}
function ReportsHub() {
  return <div className="min-w-0 space-y-6"><PageHeader title="Raporlar" scope="Geçiş kayıtları ve çalışma süreleri" /><div className="grid min-w-0 gap-x-8 gap-y-6 md:grid-cols-2">{REPORT_GROUPS.map(group => <section key={group.key} className="min-w-0 border-t border-line pt-4"><Link to={reportGroupPath(group.key)} className="flex min-h-11 items-center gap-2 text-base font-semibold hover:underline"><FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{group.label}</Link><p className="mt-2 text-sm text-muted-foreground">{group.description}</p><ul className="mt-3 space-y-1">{reportsInGroup(group.key).map(report => <li key={report.slug}><Link to={reportGroupPath(group.key, report.slug)} className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-subtle focus-visible:outline focus-visible:outline-ring"><FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{report.title}</Link></li>)}{group.key === 'resmi' && <li><Link to={reportGroupPath('resmi')} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-subtle focus-visible:outline focus-visible:outline-ring">Resmi raporları aç</Link></li>}</ul></section>)}</div></div>;
}
export default function Reports() {
  const { group, slug } = useParams<{ group: string; slug: string }>();
  const navigate = useNavigate();
  if (!group) return <ReportsHub />;
  if (!isReportGroupKey(group)) return <MissingReport />;
  const reports = reportsInGroup(group);
  const report = slug ? getReport(group, slug) : undefined;
  if (slug && !report) return <MissingReport />;
  const groupMeta = REPORT_GROUPS.find(item => item.key === group);
  return <div className="min-w-0 space-y-4"><Link to={REPORTS_BASE_PATH} className="inline-flex min-h-9 items-center text-xs text-muted-foreground hover:underline">Tüm raporlar</Link><div className="grid min-w-0 gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-8">
    <nav aria-label={`${groupMeta?.label ?? ''} raporları`} className="min-w-0">
      <div className="lg:hidden"><Select value={slug ?? 'group'} onValueChange={value => navigate(reportGroupPath(group, value === 'group' ? undefined : value))}><SelectTrigger aria-label="Rapor seçin"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="group">{groupMeta?.label} raporları</SelectItem>{reports.map(item => <SelectItem key={item.slug} value={item.slug}>{item.title}</SelectItem>)}</SelectContent></Select></div>
      <div className="hidden space-y-1 lg:block"><Link to={reportGroupPath(group)} aria-current={!slug ? 'page' : undefined} className="mb-3 block text-sm font-semibold">{groupMeta?.label}</Link>{reports.map(item => <Link key={item.slug} to={reportGroupPath(group, item.slug)} aria-current={slug === item.slug ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 text-sm focus-visible:outline focus-visible:outline-ring ${slug === item.slug ? 'bg-selected font-medium text-primary' : 'hover:bg-subtle'}`}>{item.title}</Link>)}</div>
    </nav>
    <section className="min-w-0">{report ? <ReportScreen key={report.slug} definition={report} /> : group === 'resmi' ? <OfficialReports /> : <div className="space-y-5"><PageHeader title={`${groupMeta?.label} Raporları`} scope={groupMeta?.description} /><div className="divide-y divide-line border-y border-line">{reports.map(item => <Link key={item.slug} to={reportGroupPath(group, item.slug)} className="block px-3 py-4 hover:bg-subtle focus-visible:outline focus-visible:outline-ring"><h2 className="text-sm font-medium">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></Link>)}</div></div>}</section>
  </div></div>;
}
