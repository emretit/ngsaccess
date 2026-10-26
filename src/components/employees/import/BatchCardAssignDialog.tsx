import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Employee } from "@/types/employee";
import { useDevices } from "@/hooks/useDevices";
import { canCaptureVisitorCard, visitorReaderLabel } from "@/components/visitors/lib/readerCapability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignReadCard, distributePastedCards, mergeAssignmentResults, type CardAssignmentRow } from "@/lib/employees/cardAssignment";

type AssignResult = { employeeId: string; status: "assigned" | "error"; message: string };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; projectId: Id<"projects">; employees: Employee[] };

function cardlessRows(employees: Employee[]): CardAssignmentRow[] {
  return employees.filter((employee) => !employee.cardNumber.trim()).map((employee) => ({
    employeeId: employee._id, employeeName: `${employee.firstName} ${employee.lastName}`, cardNumber: "",
  }));
}

export function BatchCardAssignDialog({ open, onOpenChange, projectId, employees }: Props) {
  const assignCards = useMutation(api.employeeImport.assignCards);
  const startProjectResync = useAction(api.deviceSyncRuns.startProjectResync);
  const { can } = usePermissions();
  const canCapture = can("employees.manage") || can("visitors.manage") || can("devices.manage") || can("reports.view");
  const { devices } = useDevices();
  const readers = devices.filter(canCaptureVisitorCard);
  const [rows, setRows] = useState<CardAssignmentRow[]>(() => cardlessRows(employees));
  const [readerId, setReaderId] = useState<Id<"devices"> | "">("");
  const [sinceTime, setSinceTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastReading = useRef<string | null>(null);
  const reading = useQuery(api.cardReadings.getLastUnknownByDevice,
    canCapture && open && readerId && sinceTime ? { projectId, deviceId: readerId, sinceTime } : "skip");

  useEffect(() => {
    if (!open) return;
    setRows(cardlessRows(employees));
    setSaved(false);
    setMessage(null);
    setSinceTime(null);
    lastReading.current = null;
  }, [open, employees]);

  useEffect(() => {
    if (!sinceTime || !reading || reading.accessTime === lastReading.current) return;
    lastReading.current = reading.accessTime;
    const captured = assignReadCard(rows, reading.cardNo);
    setRows(captured.rows);
    setMessage(captured.message);
    setSinceTime(null);
  }, [reading, rows, sinceTime]);

  const updateCard = (employeeId: string, cardNumber: string) => {
    setRows((current) => current.map((row) => row.employeeId === employeeId ? { ...row, cardNumber, status: undefined, message: undefined } : row));
  };
  const pasteCards = (text: string) => {
    const distribution = distributePastedCards(rows, text);
    setRows(distribution.rows);
    setMessage(distribution.rejected.length ? `${distribution.rejected.length} kart satırlara eklenemedi; yinelenen veya fazla kartları kontrol edin.` : null);
  };
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const candidates = rows.filter((row) => row.cardNumber.trim());
      const resultRows = [...rows];
      for (let index = 0; index < candidates.length; index += 100) {
        const response: AssignResult[] = await assignCards({ assignments: candidates.slice(index, index + 100).map((row) => ({ employeeId: row.employeeId as Id<"employees">, cardNumber: row.cardNumber.trim() })) });
        const merged = mergeAssignmentResults(resultRows, response);
        resultRows.splice(0, resultRows.length, ...merged);
      }
      setRows(resultRows);
      setSaved(true);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Kartlar atanamadı.");
    } finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Toplu kart ata</DialogTitle><DialogDescription>Kartı olmayan seçili kişilere kart numarası girin veya okuyucudan okutun.</DialogDescription></DialogHeader>
      {rows.length === 0 ? <p role="status">Seçili kişilerin hepsinde kart var.</p> : <>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="batch-card-reader" className="text-sm">Okuyucu</label>
          <select id="batch-card-reader" className="h-9 rounded-md border bg-background px-3 text-sm" value={readerId} onChange={(event) => { setReaderId(event.target.value as Id<"devices"> | ""); setSinceTime(null); }}>
            <option value="">Okuyucu seçin</option>
            {readers.map((device) => <option key={device._id} value={device._id}>{visitorReaderLabel(device)}</option>)}
          </select>
          <Button type="button" variant="outline" disabled={!readerId || !!sinceTime} onClick={() => { setMessage(null); lastReading.current = null; setSinceTime(new Date().toISOString()); }}> {sinceTime ? "Kart bekleniyor…" : "Okut"}</Button>
        </div>
        {rows.map((row) => <div key={row.employeeId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 rounded border p-3">
          <span className="text-sm font-medium">{row.employeeName}</span>
          <div><Input aria-label={`${row.employeeName} kart numarası`} value={row.cardNumber} disabled={busy || row.status === "assigned"} onChange={(event) => updateCard(row.employeeId, event.target.value)} onPaste={(event) => { const pasted = event.clipboardData.getData("text"); if (pasted.includes("\n")) { event.preventDefault(); pasteCards(pasted); } }} />{row.message && <p className={row.status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{row.message}</p>}</div>
        </div>)}
        {message && <p role="status" className="text-sm">{message}</p>}
        {saved && <p role="status">Atanan: {rows.filter((row) => row.status === "assigned").length} · Hatalı: {rows.filter((row) => row.status === "error").length}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {saved && <Button variant="outline" onClick={() => void startProjectResync({ projectId }).then(() => setMessage("Cihazlara gönderim başlatıldı.")).catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Cihazlara gönderim başlatılamadı."))}>Cihazlara gönder</Button>}
          <Button disabled={busy || rows.every((row) => !row.cardNumber.trim() || row.status === "assigned")} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Kaydet"}</Button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
