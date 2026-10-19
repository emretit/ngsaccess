import { useMemo, useReducer, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { ReportPage } from './ReportPage';
import { monthlyRowsForReport, buildTransactionRows, dailyRowsForReport } from '@/lib/reports/rows';
import { dailyReportArgs, monthlyReportArgs, transactionReportArgs } from '@/lib/reports/query';
import { transactionReducer, transactionSnapshot } from '@/lib/reports/transactions';
import type { ReportDefinition } from '@/lib/reports/registry';
import type { ReportExportMeta } from '@/lib/reports/export';

export interface ReportResultsProps {
  definition: ReportDefinition; projectId: Id<'projects'>; from: string; to: string; person: string;
  departmentId?: Id<'departments'>; departmentName?: string;
  result?: 'granted' | 'denied' | 'unknown'; year: number; month: number; projectName?: string;
}
function meta(props: ReportResultsProps): Omit<ReportExportMeta, 'columns'> {
  return { from: props.from, to: props.to, projectName: props.projectName };
}
function DailyResults(props: ReportResultsProps) {
  const data = useQuery(api.cardReadings.getPdksTableData, dailyReportArgs(props, props.definition));
  return <ReportPage definition={props.definition} rows={dailyRowsForReport(data ?? [], props.definition.slug)} loading={data === undefined} meta={meta(props)}>
    {props.definition.group === 'kayitlar' && <p className="text-xs text-muted-foreground">Biyometrik doğrulamalı geçişler KVKK gereği PDKS raporlarında gösterilmez.</p>}
  </ReportPage>;
}
function MonthlyResults(props: ReportResultsProps) {
  const sheet = useQuery(api.cardReadings.getMonthlyPayrollSheet, monthlyReportArgs(props));
  const rows = useMemo(() => sheet ? monthlyRowsForReport(sheet, props.definition.monthlyRows, props.person, props.departmentName) : [], [sheet, props.definition.monthlyRows, props.departmentName, props.person]);
  return <ReportPage definition={props.definition} rows={rows} days={sheet?.days} loading={sheet === undefined} meta={meta(props)}>
    {props.definition.monthlyDays === 'code' && <p className="text-xs text-muted-foreground">Kodlar: N normal · DV devamsız · İZN izinli · HT hafta tatili · RT resmî tatil · — henüz gelmedi / veri yok.</p>}
  </ReportPage>;
}
function TransactionResults(props: ReportResultsProps) {
  const [snapshots, dispatch] = useReducer(transactionReducer, { pages: {} });
  const [cursor, setCursor] = useState<string | null>(null);
  const current = useQuery(api.cardReadings.listReportTransactions, { ...transactionReportArgs(props, props.definition), paginationOpts: { numItems: 50, cursor } });
  const snapshot = useMemo(() => transactionSnapshot(snapshots, cursor, current), [snapshots, cursor, current]);
  const rows = useMemo(() => buildTransactionRows(snapshot.rows, props.person, props.departmentName), [snapshot.rows, props.departmentName, props.person]);
  const loadMore = () => {
    if (!current || current.isDone) return;
    dispatch({ type: 'page', cursor, page: current });
    setCursor(current.continueCursor);
  };
  return <ReportPage definition={props.definition} rows={rows} loading={current === undefined && cursor === null} hasMoreTransactions={!snapshot.isDone} loadedCount={snapshot.rows.length} meta={meta(props)}>
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>Biyometrik doğrulamalı geçişler KVKK gereği PDKS raporlarında gösterilmez.</p>
      {!props.definition.transactionSources && snapshot.hiddenBiometricCount > 0 && <p role="status">Yüklenen sayfalarda {snapshot.hiddenBiometricCount} biyometrik kayıt gizlendi (kişi/departman filtresinden bağımsız).</p>}
      <p>Yalnız yüklenen kayıtlar dışa aktarılır. Kişi ve departman filtreleri yüklenen kayıtlara uygulanır.</p>
      {!snapshot.isDone && <p>Bu sayfada eşleşme bulunmasa da daha fazla kayıt yükleyebilirsiniz.</p>}
      <p>Yenile ile güncel kayıtları getir.</p>
    </div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={current === undefined || snapshot.isDone} onClick={loadMore}>{current === undefined ? 'Yükleniyor…' : snapshot.isDone ? 'Tüm kayıtlar yüklendi' : 'Daha fazla yükle'}</Button></div>
  </ReportPage>;
}
export function ReportResults(props: ReportResultsProps) {
  if (props.definition.dataSource === 'pdksMatrix') return <DailyResults {...props} />;
  if (props.definition.dataSource === 'monthlyPayroll') return <MonthlyResults {...props} />;
  return <TransactionResults {...props} />;
}
