import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useConvex, useQuery } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
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
  employeeId?: Id<'employees'>; onClear?: () => void; departmentId?: Id<'departments'>; departmentName?: string;
  result?: 'granted' | 'denied' | 'unknown'; year: number; month: number; projectName?: string;
}
function meta(props: ReportResultsProps): Omit<ReportExportMeta, 'columns'> {
  return { from: props.from, to: props.to, projectName: props.projectName };
}
type PdksTableArgs = FunctionArgs<typeof api.cardReadings.getPdksTableData>;
type PdksTableData = FunctionReturnType<typeof api.cardReadings.getPdksTableData>;
/** Month-long punch reports are fetched once per filter set (the parent remounts on every filter or
 * "Yeniden yükle"): a live subscription would resend the whole month after every new reading. */
function usePdksTableSnapshot(args: PdksTableArgs, enabled: boolean): PdksTableData | undefined {
  const convex = useConvex();
  const argsRef = useRef(args);
  const [state, setState] = useState<{ data?: PdksTableData; error?: unknown }>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    convex.query(api.cardReadings.getPdksTableData, argsRef.current).then(
      data => { if (alive) setState({ data }); },
      (error: unknown) => { if (alive) setState({ error }); },
    );
    return () => { alive = false; };
  }, [convex, enabled]);
  if (state.error !== undefined) throw state.error;
  return state.data;
}
function DailyResults(props: ReportResultsProps) {
  const args = dailyReportArgs(props, props.definition);
  const snapshot = props.definition.rowsMode === 'personMonth';
  const live = useQuery(api.cardReadings.getPdksTableData, snapshot ? 'skip' : args);
  const once = usePdksTableSnapshot(args, snapshot);
  const data = snapshot ? once : live;
  const rows = useMemo(() => props.definition.rowsMode === 'personMonth' ? buildPersonMonthRows(data ?? []) : dailyRowsForReport(data ?? [], props.definition.slug, props.violationsOnly), [data, props.definition.rowsMode, props.definition.slug, props.violationsOnly]);
  const days = useMemo(() => [...new Set((data ?? []).flatMap(row => row.days.map(cell => cell.date)))].sort(), [data]);
  return <ReportPage days={days} projectId={props.projectId} onClear={props.onClear} definition={props.definition} rows={rows} loading={data === undefined} meta={meta(props)}>
    {props.definition.group === 'kayitlar' && <p className="text-xs text-muted-foreground">Biyometrik doğrulamalı geçişler KVKK gereği PDKS raporlarında gösterilmez.</p>}
    {snapshot && <p className="text-xs text-muted-foreground">Rapor açıldığı andaki verileri gösterir; yeni okutmalar için “Yeniden yükle”. Kalabalık projelerde departman seçerek raporu küçültün.</p>}
  </ReportPage>;
}
function MonthlyResults(props: ReportResultsProps) {
  const sheet = useQuery(api.cardReadings.getMonthlyPayrollSheet, monthlyReportArgs(props));
  const rows = useMemo(() => sheet ? monthlyRowsForReport(sheet, props.definition.monthlyRows, props.person, props.departmentName) : [], [sheet, props.definition.monthlyRows, props.departmentName, props.person]);
  return <ReportPage projectId={props.projectId} onClear={props.onClear} definition={props.definition} rows={rows} days={sheet?.days} loading={sheet === undefined} meta={meta(props)}>
    {props.definition.monthlyDays === 'code' && <p className="text-xs text-muted-foreground">Kodlar: N normal · DV devamsız · İZN izinli · HT hafta tatili · RT resmî tatil · — henüz gelmedi / veri yok.</p>}
  </ReportPage>;
}
function TransactionResults(props: ReportResultsProps) {
  const [snapshots, dispatch] = useReducer(transactionReducer, { pages: {} });
  const [cursor, setCursor] = useState<string | null>(null);
  const current = useQuery(api.cardReadings.listReportTransactions, { ...transactionReportArgs(props, props.definition), paginationOpts: { numItems: 50, cursor } });
  const snapshot = useMemo(() => transactionSnapshot(snapshots, cursor, current), [snapshots, cursor, current]);
  const rows = useMemo(() => buildTransactionRows(snapshot.rows), [snapshot.rows]);
  const loadMore = () => {
    if (!current || current.isDone) return;
    dispatch({ type: 'page', cursor, page: current });
    setCursor(current.continueCursor);
  };
  return <ReportPage projectId={props.projectId} onClear={props.onClear} definition={props.definition} rows={rows} loading={current === undefined && cursor === null} hasMoreTransactions={!snapshot.isDone} loadedCount={snapshot.rows.length} meta={meta(props)}>
    <p className="text-xs text-muted-foreground">Yalnız yüklenen kayıtlar dışa aktarılır. Biyometrik doğrulamalı geçişler KVKK gereği gösterilmez.{snapshot.hiddenBiometricCount > 0 ? ` ${snapshot.hiddenBiometricCount} biyometrik kayıt gizlendi.` : ''}</p>
    {!snapshot.isDone && <Button variant="outline" disabled={current === undefined} onClick={loadMore}>{current === undefined ? 'Yükleniyor…' : 'Daha fazla yükle'}</Button>}
  </ReportPage>;
}
export function ReportResults(props: ReportResultsProps) {
  if (props.definition.dataSource === 'pdksMatrix') return <DailyResults {...props} />;
  if (props.definition.dataSource === 'monthlyPayroll') return <MonthlyResults {...props} />;
  return <TransactionResults {...props} />;
}
