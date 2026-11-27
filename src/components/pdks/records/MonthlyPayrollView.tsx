import { usePdksPayrollSnapshot } from "@/hooks/usePdksSnapshot";
import { Button } from "@/components/ui/button";
import { useQuery, usePaginatedQuery } from "convex/react";
import { makeFunctionReference, type ApiFromModules, type FunctionArgs, type FunctionReturnType } from "convex/server";
import type * as periods from "../../../../convex/payrollPeriods";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PayrollPeriodPanel } from "./PayrollPeriodPanel";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PeriodApi = ApiFromModules<{ payrollPeriods: typeof periods }>["payrollPeriods"];
const getPeriod = makeFunctionReference<"query", FunctionArgs<PeriodApi["getPayrollPeriod"]>, FunctionReturnType<PeriodApi["getPayrollPeriod"]>>("payrollPeriods:getPayrollPeriod");
const getRows = makeFunctionReference<"query", FunctionArgs<PeriodApi["listPayrollPeriodRows"]>, FunctionReturnType<PeriodApi["listPayrollPeriodRows"]>>("payrollPeriods:listPayrollPeriodRows");

export function MonthlyPayrollView({ projectId, period, visibleEmployeeIds, onCellClick }: {
  projectId: Id<"projects">; period: string; visibleEmployeeIds?: ReadonlySet<string>;
  onCellClick: (employeeId: string, date: string) => void;
}) {
  const [year, month] = period.split("-").map(Number);
  const current = useQuery(getPeriod, { projectId, period });
  const closed = current?.status === "closed";
  const frozen = usePaginatedQuery(getRows, closed && current.snapshotReady ? { projectId, period } : "skip", { initialNumItems: 25 });
  const snapshot = usePdksPayrollSnapshot(current === undefined || closed ? "skip" : { projectId, year, month });
  const sheet = snapshot.data;
  const days = sheet?.days ?? Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
  const rows = (closed ? frozen.results : sheet?.rows)?.filter(row => !visibleEmployeeIds || visibleEmployeeIds.has(row.employeeId)) ?? [];
  return <div className="space-y-4">
    {!closed && <div className="text-xs"><Button variant="outline" onClick={snapshot.refresh}>Verileri yenile</Button><p>Hesap açıldığı andaki verileri gösterir.</p>{snapshot.error && <p role="alert">{snapshot.error}</p>}</div>}
    <PayrollPeriodPanel projectId={projectId} period={period} />
    <Table framed scrollLabel="Aylık bordro"><TableHeader><TableRow>
      <TableHead>Personel</TableHead>{days.map(day => <TableHead key={day}>{day.slice(-2)}</TableHead>)}<TableHead>Toplam dakika</TableHead>
    </TableRow></TableHeader><TableBody>
      {closed && current.snapshotError ? <TableStateRow colSpan={days.length + 2} state="custom">{current.snapshotError}</TableStateRow> : (closed ? !current.snapshotReady || frozen.status === "LoadingFirstPage" : !sheet) ? <TableStateRow colSpan={33} state="loading" /> : rows.length === 0 ? <TableStateRow colSpan={days.length + 2} state="empty" title="Bordro kaydı bulunamadı." /> : rows.map(row => <TableRow key={row.employeeId}>
        <TableCell>{row.name}</TableCell>{days.map(day => { const cell = row.cells.find(cell => cell.date === day); return <TableCell key={day} title={`${day}: ${cell?.totalMinutes ?? 0} dakika`}><Button variant="ghost" size="sm" className="h-7 px-1" aria-label={`${row.name}, ${day}, ${cell?.payrollCode ?? "kayıt yok"}, canlı ayrıntıları aç`} onClick={() => onCellClick(row.employeeId, day)}>{cell?.payrollCode ?? "—"}</Button></TableCell>; })}<TableCell>{row.totals.totalMinutes}</TableCell>
      </TableRow>)}
    </TableBody></Table>
    {closed && frozen.status === "CanLoadMore" && <Button variant="outline" onClick={() => frozen.loadMore(25)}>Daha fazla personel göster</Button>}
  </div>;
}
