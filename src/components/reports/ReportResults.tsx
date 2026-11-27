import { usePdksTableSnapshot as useBatchedTable, usePdksPayrollSnapshot } from "@/hooks/usePdksSnapshot";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemo, useReducer, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter';
import { ReportPage } from './ReportPage';
import { monthlyRowsForReport, buildTransactionRows, dailyRowsForReport } from '@/lib/reports/rows';
import { buildPersonMonthRows } from '@/lib/reports/personMonth';
import { dailyReportArgs, monthlyReportArgs, transactionReportArgs } from '@/lib/reports/query';
import { transactionReducer, transactionSnapshot } from '@/lib/reports/transactions';
import type { ReportDefinition } from '@/lib/reports/registry';
import type { ReportExportMeta } from '@/lib/reports/export';

export interface ReportResultsProps {
  violationsOnly?: boolean;
  definition: ReportDefinition; projectId: Id<'projects'>; from: string; to: string; person: string;
  employeeId?: Id<'employees'>; onClear?: () => void; companyId?: Id<'companies'>; departmentId?: Id<'departments'>; departmentName?: string;
  result?: 'granted' | 'denied' | 'unknown'; year: number; month: number; projectName?: string;
}
function meta(props: ReportResultsProps): Omit<ReportExportMeta, 'columns'> {
  return { from: props.from, to: props.to, projectName: props.projectName };
}
function DailyResults(props: ReportResultsProps) {
  const args = dailyReportArgs(props, props.definition);
  const { can } = usePermissions();
  const enabled = can("reports.view") && !!props.projectId;
  const snapshot = true;
  const once = useBatchedTable(enabled && snapshot ? args : "skip");
  const data = once.data;
  const rows = useMemo(() => props.definition.rowsMode === 'personMonth' ? buildPersonMonthRows(data ?? []) : dailyRowsForReport(data ?? [], props.definition.slug, props.violationsOnly), [data, props.definition.rowsMode, props.definition.slug, props.violationsOnly]);
  const days = useMemo(() => [...new Set((data ?? []).flatMap(row => row.days.map(cell => cell.date)))].sort(), [data]);
  if (once.error) return <div role="alert"><p>{once.error}</p><button type="button" onClick={once.refresh}>Yeniden dene</button></div>;
  return <ReportPage days={days} projectId={props.projectId} onClear={props.onClear} definition={props.definition} rows={rows} loading={data === undefined} meta={meta(props)}>
    {snapshot && <button type="button" onClick={once.refresh}>Verileri yenile</button>}
    {snapshot && <p className="text-xs text-muted-foreground">Rapor açıldığı andaki verileri gösterir; yeni okutmalar için “Verileri yenile”.</p>}
  </ReportPage>;
}
function MonthlyResults(props: ReportResultsProps) {
  const { can } = usePermissions();
  const snapshot = usePdksPayrollSnapshot(can("reports.view") && props.projectId ? monthlyReportArgs(props) : "skip");
  const sheet = snapshot.data;
  const rows = useMemo(() => sheet ? monthlyRowsForReport(sheet, props.definition.monthlyRows, props.person, props.departmentName) : [], [sheet, props.definition.monthlyRows, props.departmentName, props.person]);
  if (snapshot.error) return <div role="alert"><p>{snapshot.error}</p><button type="button" onClick={snapshot.refresh}>Yeniden dene</button></div>;
  return <ReportPage projectId={props.projectId} onClear={props.onClear} definition={props.definition} rows={rows} days={sheet?.days} loading={sheet === undefined} meta={meta(props)}>
    <button type="button" onClick={snapshot.refresh}>Verileri yenile</button>
    {props.definition.monthlyDays === 'code' && <p className="text-xs text-muted-foreground">Kodlar: N normal · DV devamsız · İZN izinli · HT hafta tatili · RT resmî tatil · — henüz gelmedi / veri yok.</p>}
  </ReportPage>;
}
function TransactionResults(props: ReportResultsProps) {
  const [snapshots, dispatch] = useReducer(transactionReducer, { pages: {} });
  const [cursor, setCursor] = useState<string | null>(null);
  const { can } = usePermissions();
  const current = useQuery(api.cardReadings.listReportTransactions, can("reports.view") && props.projectId ? { ...transactionReportArgs(props, props.definition), paginationOpts: { numItems: 50, cursor } } : "skip");
  const snapshot = useMemo(() => transactionSnapshot(snapshots, cursor, current), [snapshots, cursor, current]);
  const rows = useMemo(() => buildTransactionRows(snapshot.rows), [snapshot.rows]);
  const loadMore = () => {
    if (!current || current.isDone) return;
    dispatch({ type: 'page', cursor, page: current });
    setCursor(current.continueCursor);
  };
  return <ReportPage projectId={props.projectId} onClear={props.onClear} definition={props.definition} rows={rows} loading={current === undefined && cursor === null} hasMoreTransactions={!snapshot.isDone} loadedCount={snapshot.rows.length} meta={meta(props)}>
    <LoadMoreFooter
      hasMore={!snapshot.isDone}
      loading={current === undefined}
      onLoadMore={loadMore}
      summary={<p className="text-xs text-muted-foreground">Yalnız yüklenen kayıtlar dışa aktarılır.</p>}
    />
  </ReportPage>;
}
export function ReportResults(props: ReportResultsProps) {
  const { can } = usePermissions();
  if (!can("reports.view") || !props.projectId) return null;
  if (props.definition.dataSource === 'pdksMatrix') return <DailyResults {...props} />;
  if (props.definition.dataSource === 'monthlyPayroll') return <MonthlyResults {...props} />;
  return <TransactionResults {...props} />;
}
