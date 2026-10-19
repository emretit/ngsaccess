import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseEmployeesXlsx } from "@/lib/employees/parseEmployeesXlsx";
import type { EmployeeImportIssue, EmployeeImportRow } from "@/lib/employees/employeeExcelTypes";

type ImportResult = { rowNumber: number; status: "created" | "skippedDuplicate" | "error"; message: string };
type Stage = "file" | "preview" | "importing" | "done";

async function downloadImportErrors(results: ImportResult[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hatalı satırlar");
  sheet.addRow(["Excel satırı", "Durum", "Hata mesajı"]);
  results.filter((result) => result.status === "error").forEach((result) => sheet.addRow([result.rowNumber, "Hata", result.message]));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 32; });
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "kisiler-ice-aktarma-hatalari.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

function combineIssues(issues: EmployeeImportIssue[]) {
  const grouped = new Map<number, string[]>();
  for (const issue of issues) grouped.set(issue.rowNumber, [...(grouped.get(issue.rowNumber) ?? []), issue.message]);
  return grouped;
}

export function EmployeeImportDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: Id<"projects"> }) {
  const importChunk = useMutation(api.employeeImport.importChunk);
  const startProjectResync = useAction(api.deviceSyncRuns.startProjectResync);
  const [stage, setStage] = useState<Stage>("file");
  const [rows, setRows] = useState<EmployeeImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [eligibleRows, setEligibleRows] = useState<EmployeeImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasCancelled, setWasCancelled] = useState(false);
  const [syncStarted, setSyncStarted] = useState(false);
  const cancelled = useRef(false);

  const reset = () => {
    cancelled.current = false;
    setStage("file"); setRows([]); setResults([]); setEligibleRows([]); setProgress(0); setError(null); setSyncMessage(null); setBusy(false); setWasCancelled(false); setSyncStarted(false);
  };
  const setOpen = (next: boolean) => {
    if (!next && busy) return;
    if (!next && stage === "done" && !syncStarted && results.some((result) => result.status === "created" && result.message === "Kişi oluşturuldu") && !window.confirm("İçe aktarılan kişiler henüz cihazlara gönderilmedi. Yine de kapatmak istiyor musunuz?")) return;
    if (!next) reset(); onOpenChange(next);
  };
  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setBusy(true);
    try {
      const parsed = await parseEmployeesXlsx(file);
      const localErrors = combineIssues(parsed.issues);
      const validRows = parsed.rows.filter((row) => !localErrors.has(row.rowNumber));
      const previewResults: ImportResult[] = [...localErrors.entries()].map(([rowNumber, messages]) => ({ rowNumber, status: "error", message: messages.join(" ") }));
      const serverResults: ImportResult[] = [];
      for (let index = 0; index < validRows.length; index += 100) {
        serverResults.push(...await importChunk({ projectId, rows: validRows.slice(index, index + 100), dryRun: true }));
      }
      setRows(parsed.rows);
      setEligibleRows(validRows.filter((row) => serverResults.find((result) => result.rowNumber === row.rowNumber)?.status === "created"));
      setResults([...previewResults, ...serverResults].sort((a, b) => a.rowNumber - b.rowNumber));
      setStage("preview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dosya okunamadı.");
    } finally { setBusy(false); }
  };
  const confirmImport = async () => {
    setError(null); setBusy(true); cancelled.current = false; setStage("importing");
    const completed: ImportResult[] = [...results.filter((result) => result.status !== "created")];
    try {
      for (let index = 0; index < eligibleRows.length; index += 100) {
        if (cancelled.current) break;
        completed.push(...await importChunk({ projectId, rows: eligibleRows.slice(index, index + 100), dryRun: false }));
        setProgress(Math.round(Math.min(index + 100, eligibleRows.length) / eligibleRows.length * 100));
        setResults([...completed].sort((a, b) => a.rowNumber - b.rowNumber));
      }
      setResults(completed.sort((a, b) => a.rowNumber - b.rowNumber));
      setWasCancelled(cancelled.current);
      setStage("done");
    } catch (cause) {
      setResults(completed.sort((a, b) => a.rowNumber - b.rowNumber));
      setStage("done");
      setError(cause instanceof Error ? cause.message : "İçe aktarma sırasında hata oluştu.");
    } finally { setBusy(false); }
  };
  const validCount = results.filter((result) => result.status === "created").length;
  const duplicateCount = results.filter((result) => result.status === "skippedDuplicate").length;
  const errorResults = results.filter((result) => result.status === "error");

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Kişileri Excel’den içe aktar</DialogTitle>
        <DialogDescription>En fazla 5 MB ve 1000 kişi satırı içeren .xlsx dosyası seçin. Dosyanız yalnızca bu aktarım sırasında işlenir.</DialogDescription>
      </DialogHeader>
      {stage === "file" && <div className="space-y-3"><Input aria-label="Excel dosyası seç" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} />{busy && <p role="status">Dosya kontrol ediliyor ve önizleme hazırlanıyor…</p>}</div>}
      {stage === "preview" && <div className="space-y-4">
        <p>{rows.length} satır · {validCount} aktarılabilir · {duplicateCount} yinelenen · {errorResults.length} hatalı</p>
        {errorResults.length > 0 && <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-3 text-sm">{errorResults.slice(0, 20).map((result) => <p key={result.rowNumber}>Satır {result.rowNumber}: {result.message}</p>)}</div>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setStage("file"); setResults([]); setRows([]); }}>Başka dosya seç</Button><Button disabled={validCount === 0} onClick={() => void confirmImport()}>İçe aktarmayı başlat</Button></div>
      </div>}
      {stage === "importing" && <div className="space-y-3"><p>İçe aktarma: {progress}% ({eligibleRows.length} aktarılabilir satır)</p><progress className="w-full" max={100} value={progress} /><Button variant="outline" onClick={() => { cancelled.current = true; }}>İptal et</Button></div>}
      {stage === "done" && <div className="space-y-4">
        <p>{results.filter((result) => result.status === "created" && result.message === "Kişi oluşturuldu").length} kişi oluşturuldu · {duplicateCount} yinelenen · {errorResults.length} hatalı{wasCancelled ? " · İptal edildi" : ""}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {syncMessage && <p role="status" className="text-sm">{syncMessage}</p>}
        <div className="flex flex-wrap justify-end gap-2">{errorResults.length > 0 && <Button variant="outline" onClick={() => void downloadImportErrors(results)}>Hatalı satırları indir</Button>}<Button variant="outline" onClick={() => void startProjectResync({ projectId }).then(() => { setSyncStarted(true); setSyncMessage("Cihazlara gönderim başlatıldı."); }).catch((cause: unknown) => setSyncMessage(cause instanceof Error ? cause.message : "Cihazlara gönderim başlatılamadı."))}>Cihazlara gönder</Button><Button onClick={() => setOpen(false)}>Kapat</Button></div>
      </div>}
      {error && stage !== "done" && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}
