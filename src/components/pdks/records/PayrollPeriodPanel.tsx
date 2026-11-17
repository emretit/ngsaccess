import { useState } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { FunctionArgs, FunctionReturnType, ApiFromModules } from "convex/server";
import type * as periods from "../../../../convex/payrollPeriods";
import type { Id } from "../../../../convex/_generated/dataModel";
import { usePermissions } from "@/hooks/usePermissions";
import { FilterBar } from "@/components/shared/FilterBar";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { todayInTurkey } from "@/lib/date";

type PeriodApi = ApiFromModules<{ payrollPeriods: typeof periods }>["payrollPeriods"];

// Typed references let this additive feature compile before the next Convex codegen.
const getPeriod = makeFunctionReference<"query", FunctionArgs<PeriodApi["getPayrollPeriod"]>, FunctionReturnType<PeriodApi["getPayrollPeriod"]>>("payrollPeriods:getPayrollPeriod");
const getDiffs = makeFunctionReference<"query", FunctionArgs<PeriodApi["listPayrollPeriodDiffsPage"]>, FunctionReturnType<PeriodApi["listPayrollPeriodDiffsPage"]>>("payrollPeriods:listPayrollPeriodDiffsPage");
const closePeriod = makeFunctionReference<"mutation", FunctionArgs<PeriodApi["closePayrollPeriod"]>, FunctionReturnType<PeriodApi["closePayrollPeriod"]>>("payrollPeriods:closePayrollPeriod");
const reopenPeriod = makeFunctionReference<"mutation", FunctionArgs<PeriodApi["reopenPayrollPeriod"]>, FunctionReturnType<PeriodApi["reopenPayrollPeriod"]>>("payrollPeriods:reopenPayrollPeriod");

const retryPeriod = makeFunctionReference<"mutation", FunctionArgs<PeriodApi["retryPayrollPeriod"]>, FunctionReturnType<PeriodApi["retryPayrollPeriod"]>>("payrollPeriods:retryPayrollPeriod");

export function PayrollPeriodPanel({ projectId, period }: { projectId: Id<"projects">; period: string }) {
  const { role } = usePermissions();
  const args = { projectId, period };
  const current = useQuery(getPeriod, args);
  const closed = current?.status === "closed";
  const diffs = usePaginatedQuery(getDiffs, closed && current.snapshotReady ? args : "skip", { initialNumItems: 10 });
  const canClose = period < todayInTurkey().slice(0, 7);
  const close = useMutation(closePeriod), reopen = useMutation(reopenPeriod), retry = useMutation(retryPeriod);
  const [busy, setBusy] = useState(false);
  async function change(reopening: boolean, retrying = false) {
    setBusy(true);
    try { await (retrying ? retry(args) : reopening ? reopen(args) : close(args)); toast.success(retrying ? "Kapanış tekrar başlatıldı" : reopening ? "Dönem yeniden açıldı" : "Dönem kapanışı başlatıldı"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "İşlem tamamlanamadı"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Bordro dönemi">
    <FilterBar label="Bordro dönemi" end={<>
      {!closed && (role === "admin" || role === "super_admin") && <Button disabled={busy || current === undefined || !canClose} onClick={() => void change(false)}>Dönemi kapat</Button>}
      {closed && role === "super_admin" && <Button variant="outline" disabled={busy} onClick={() => void change(true)}>Yeniden aç</Button>}
      {closed && current.snapshotError && (role === "admin" || role === "super_admin") && <Button disabled={busy} onClick={() => void change(false, true)}>Kapanışı tekrar dene</Button>}
    </>}>
      <span className="text-sm">Bordro dönemi: {period}</span>
      {closed && <Badge>Kapalı{!current.snapshotReady ? " · Sabitleniyor" : ""}</Badge>}
    </FilterBar>
    {!closed && !canClose && <p className="text-xs text-muted-foreground">Yalnız İstanbul saatine göre tamamlanmış geçmiş aylar kapatılabilir.</p>}
    {closed && current.snapshotError && <p role="alert" className="text-sm text-destructive">{current.snapshotError}</p>}
    {closed && <>
      <h3 className="text-sm font-medium">Fark incelemesi</h3>
      <p className="text-xs text-muted-foreground">Sonradan gelen okutmalar kapalı bordroyu değiştirmez. Gün ve dakika farkları canlı hesapla karşılaştırılır.</p>
      <Table framed scrollLabel="Bordro fark incelemesi"><TableHeader><TableRow>
        {["Personel", "Eski gün", "Yeni gün", "Eski dakika", "Yeni dakika"].map(label => <TableHead key={label}>{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>
        {!current.snapshotReady ? <TableStateRow colSpan={5} state="custom">{current.snapshotError ?? "Bordro sabitleniyor; fark incelemesi kapanış tamamlanınca açılır."}</TableStateRow> : diffs.status === "LoadingFirstPage" ? <TableStateRow colSpan={5} state="loading" /> : diffs.results.length === 0 ? <TableStateRow colSpan={5} state="empty" title="İncelenecek fark yok." /> : diffs.results.map(row => <TableRow key={row.employeeId}><TableCell>{row.name}</TableCell><TableCell>{row.oldDays}</TableCell><TableCell>{row.newDays}</TableCell><TableCell>{row.oldMinutes}</TableCell><TableCell>{row.newMinutes}</TableCell></TableRow>)}
      </TableBody></Table>
      {current.snapshotReady && diffs.status === "CanLoadMore" && <Button variant="outline" onClick={() => diffs.loadMore(10)}>Sonraki farkları incele</Button>}
    </>}
  </section>;
}
