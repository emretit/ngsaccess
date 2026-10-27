import { useState } from 'react';
import { useQuery } from 'convex/react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useActiveProjectScope } from '@/hooks/useActiveProjectScope';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { todayInTurkey } from '@/lib/date';
import { monthPeriod, periodError, periodFromParams, presetPeriod, reportPreset, REPORT_PRESETS, REPORT_PRESET_LABELS } from '@/lib/reports/period';
import { reportQueryKey } from '@/lib/reports/query';
import { formatReportDate } from '@/lib/reports/rows';
import { departmentLabels } from '@/lib/departmentLabel';
import type { ReportDefinition } from '@/lib/reports/registry';
import { PageHeader } from '@/components/shared/PageHeader';
import { CollapsibleFilters } from '@/components/shared/CollapsibleFilters';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { QuerySectionBoundary } from '@/components/shared/QuerySectionBoundary';
import { FormFieldWrapper } from '@/components/shared/FormFieldWrapper';
import { Button } from '@/components/ui/button';
import { DateInput, MonthPicker } from '@/components/ui/date-picker';
import { formatDateString, parseDateString } from '@/lib/date';
import { EmployeePicker } from '@/components/leaves/EmployeePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportResults } from './ReportResults';

function ScopedReport({ definition, projectId, projectName }: { definition: ReportDefinition; projectId: Id<'projects'>; projectName?: string }) {
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const departments = useQuery(api.departments.list, { projectId });
  const companies = useQuery(api.companies.list, { projectId });
  const person = useDebouncedValue(definition.filters.includes('person') ? (params.get('q') ?? '').trim() : '');
  const transactions = definition.dataSource === 'transactions';
  const searchProps = definition.filters.includes('person') && !transactions
    ? { search: params.get('q') ?? '', onSearchChange: (value: string) => update('q', value.slice(0, 200)) }
    : {};
  const period = periodFromParams(params);
  const monthly = definition.filters.includes('month');
  const monthValue = params.get('month') ?? todayInTurkey().slice(0, 7);
  const month = monthPeriod(monthValue);
  const from = monthly ? month?.from ?? '' : period.from;
  const to = monthly ? month?.to ?? '' : period.to;
  const rangeError = monthly ? month ? undefined : 'Geçerli bir ay seçin.' : periodError(from, to, definition.dataSource === 'pdksMatrix' ? 31 : 36600);
  const company = companies?.find(item => item._id === params.get('company'));
  const unknownCompany = Boolean(params.get('company')) && companies !== undefined && !company;
  const department = departments?.find(item => item._id === params.get('dept'));
  const unknownDepartment = Boolean(params.get('dept')) && departments !== undefined && !department;
  const labels = departmentLabels(departments, companies);
  const departmentOptions = departments?.filter(item => !company || item.companyId === company._id);
  const resultParam = params.get('result');
  const result = resultParam === 'granted' || resultParam === 'denied' || resultParam === 'unknown' ? resultParam : undefined;
  const update = (key: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (['from', 'to', 'month'].includes(key) || value && value !== 'all') next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const changeCompany = (value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value !== 'all') next.set('company', value); else next.delete('company');
    // Departman şirketin altındadır; şirket değişince eski departman seçimi geçersiz olur.
    next.delete('dept');
    return next;
  }, { replace: true });
  const changePreset = (value: string) => setParams(previous => {
    const next = new URLSearchParams(previous); const preset = reportPreset(value);
    next.set('preset', preset);
    if (preset === 'custom') { next.set('from', period.from); next.set('to', period.to); }
    else { const range = presetPeriod(preset); next.set('from', range.from); next.set('to', range.to); }
    return next;
  }, { replace: true });
  const clear = () => setParams(previous => { const next = new URLSearchParams(previous); ['company', 'dept', 'q', 'employee', 'result', 'ihlal'].forEach(key => next.delete(key)); return next; }, { replace: true });
  const queryKey = reportQueryKey(definition, { projectId, from, to, companyId: company?._id, departmentId: department?._id, employeeId: transactions && params.get('employee') ? params.get('employee') as Id<'employees'> : undefined, person, result, year: month?.year ?? 2000, month: month?.month ?? 1 }, revision);
  return <div className="min-w-0 space-y-4">
    <div className="rounded-md border border-line p-3 md:border-0 md:p-0"><CollapsibleFilters buttonVariant="ghost" buttonClassName="min-h-11">
    <FilterBar {...searchProps} label={definition.filters.includes('person') && !transactions ? 'Liste filtreleri' : 'Rapor filtreleri'} searchLabel="Kişi ara" placeholder="Ad soyad ara" onClear={clear} hasFilters={Boolean(params.get('company') || params.get('dept') || params.get('employee') || result || params.get('ihlal'))}>
      {transactions && <FormFieldWrapper htmlFor="report-person" label="Kişi" className="w-full sm:w-64"><EmployeePicker projectId={projectId} value={params.get('employee') ?? ''} onChange={value => update('employee', value)} control={{ id: 'report-person', 'aria-invalid': false }} allowAll /></FormFieldWrapper>}
      <FormFieldWrapper htmlFor="report-period" label={monthly ? 'Ay' : 'Dönem'} className="w-full sm:w-44">
        {monthly ? <MonthPicker id="report-period" date={parseDateString(`${monthValue}-01`)} onSelect={date => update('month', formatDateString(date).slice(0, 7))} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'report-range-error' : undefined} /> : <Select value={period.preset} onValueChange={changePreset}><SelectTrigger id="report-period"><SelectValue /></SelectTrigger><SelectContent>{REPORT_PRESETS.map(key => <SelectItem key={key} value={key}>{REPORT_PRESET_LABELS[key]}</SelectItem>)}</SelectContent></Select>}
      </FormFieldWrapper>
      {(companies?.length || params.get('company')) ? <FormFieldWrapper htmlFor="report-company" label="Şirket" className="w-full sm:w-44"><Select value={params.get('company') || 'all'} onValueChange={changeCompany}><SelectTrigger id="report-company"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm şirketler</SelectItem>{companies?.map(item => <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>)}{params.get('company') && !company && <SelectItem value={params.get('company') ?? ''}>Seçili şirket bulunamadı</SelectItem>}</SelectContent></Select></FormFieldWrapper> : null}
      <FormFieldWrapper htmlFor="report-department" label="Departman" className="w-full sm:w-48"><Select value={params.get('dept') || 'all'} onValueChange={value => update('dept', value)}><SelectTrigger id="report-department"><SelectValue placeholder="Departmanlar yükleniyor…" /></SelectTrigger><SelectContent><SelectItem value="all">Tüm departmanlar</SelectItem>{departmentOptions?.map(item => <SelectItem key={item._id} value={item._id}>{company ? item.name : labels.get(item._id) ?? item.name}</SelectItem>)}{params.get('dept') && !department && <SelectItem value={params.get('dept') ?? ''}>Seçili departman bulunamadı</SelectItem>}</SelectContent></Select></FormFieldWrapper>
      {definition.filters.includes('breakViolation') && <FormFieldWrapper htmlFor="report-break" label="Mola" className="w-full sm:w-44"><Select value={params.get('ihlal') === '1' ? '1' : 'all'} onValueChange={value => update('ihlal', value)}><SelectTrigger id="report-break"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm molalar</SelectItem><SelectItem value="1">Yalnız ihlaller</SelectItem></SelectContent></Select></FormFieldWrapper>}
      {definition.dataSource === 'transactions' && <FormFieldWrapper htmlFor="report-result" label="Sonuç" className="w-full sm:w-40"><Select value={result ?? 'all'} onValueChange={value => update('result', value)}><SelectTrigger id="report-result"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm sonuçlar</SelectItem><SelectItem value="granted">İzin verildi</SelectItem><SelectItem value="denied">Reddedildi</SelectItem><SelectItem value="unknown">Bilinmiyor</SelectItem></SelectContent></Select></FormFieldWrapper>}
    </FilterBar>
    {!monthly && period.preset === 'custom' && <div className="grid min-w-0 gap-3 sm:max-w-lg sm:grid-cols-2"><FormFieldWrapper htmlFor="report-from" label="Başlangıç"><DateInput id="report-from" required value={period.from} onChange={value => update('from', value)} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'report-range-error' : undefined} /></FormFieldWrapper><FormFieldWrapper htmlFor="report-to" label="Bitiş"><DateInput id="report-to" required value={period.to} onChange={value => update('to', value)} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'report-range-error' : undefined} /></FormFieldWrapper></div>}
    </CollapsibleFilters></div>
    {rangeError && <p id="report-range-error" role="alert" className="text-sm text-destructive">{rangeError}</p>}
    {unknownCompany && <p role="alert" className="text-sm text-destructive">Seçili şirket bu projede bulunamadı. Şirket filtresini temizleyin.</p>}
    {unknownDepartment && <p role="alert" className="text-sm text-destructive">Seçili departman bu projede bulunamadı. Departman filtresini temizleyin.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3"><p className="text-xs text-muted-foreground">{!rangeError ? `${formatReportDate(from)} – ${formatReportDate(to)}` : ''}</p><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>{transactions ? 'Listeyi baştan yükle' : 'Yeniden yükle'}</Button></div>
    {rangeError || unknownDepartment || unknownCompany ? null : (params.get('dept') && departments === undefined) || (params.get('company') && companies === undefined) ? <SectionSkeleton label="Departman yükleniyor…" /> : <QuerySectionBoundary resetKey={queryKey} title="Rapor yüklenemedi" description="Dönemi kontrol edip yeniden deneyebilirsiniz."><ReportResults violationsOnly={definition.filters.includes('breakViolation') && params.get('ihlal') === '1'} key={queryKey} definition={definition} onClear={clear} employeeId={transactions && params.get('employee') ? params.get('employee') as Id<'employees'> : undefined} projectId={projectId} projectName={projectName} from={from} to={to} companyId={company?._id} departmentId={department?._id} departmentName={department?.name} person={person} result={result} year={month?.year ?? 2000} month={month?.month ?? 1} /></QuerySectionBoundary>}
  </div>;
}
export function ReportScreen({ definition }: { definition: ReportDefinition }) {
  const { projectId, activeProject, loading } = useActiveProjectScope();
  return <div className="min-w-0 space-y-5"><PageHeader title={definition.title} scope={`${activeProject?.name ?? 'Proje seçilmedi'} · İstanbul saati (UTC+3)`} /><p className="text-sm text-muted-foreground">{definition.description}</p>
    {loading ? <SectionSkeleton label="Proje yükleniyor…" /> : !projectId ? <EmptyState title="Bir proje seçin" description="Raporları görmek için üst çubuktan bir proje seçin." /> : <QuerySectionBoundary resetKey={`${projectId}:${definition.slug}`} title="Rapor filtreleri yüklenemedi"><ScopedReport key={`${projectId}:${definition.slug}`} definition={definition} projectId={projectId} projectName={activeProject?.name} /></QuerySectionBoundary>}
  </div>;
}
