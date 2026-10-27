import { useRef, useState, type ChangeEvent } from "react";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/notify";
import { api } from "../../../../convex/_generated/api";

type Preview = FunctionReturnType<typeof api.actions.pdksImport.previewPdksCsv>;
type ImportResult = {
  inserted: number;
  updated: number;
  errors: number | { index: number; message: string }[];
};
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const SAMPLE_CSV = `tcNo,tarih,giriş,çıkış,not
12345678901,2026-05-15,09:00,18:00,Manuel düzeltme
98765432109,2026-05-15,08:30,17:30,`;

export function PDKSImportDialog(props: Props) {
  return props.open ? <ImportForm {...props} /> : null;
}
function ImportForm({ onOpenChange }: Props) {
  const { projectId, activeProject } = useActiveProject();
  const [csvText, setCsvText] = useState("");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [serverError, setServerError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const requireProject = () => { if (!projectId) throw new Error("Bir proje seçin."); return projectId; };
  const previewAction = useAction(api.actions.pdksImport.previewPdksCsv);
  const importAction = useAction(api.actions.pdksImport.importPdksCsv);
  const close = (open: boolean) => {
    if (!lock.current) onOpenChange(open);
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCsvText(await file.text());
      setServerError("");
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };
  const handlePreview = async () => {
    if (lock.current || !csvText.trim()) return;
    lock.current = true;
    setPending(true);
    setServerError("");
    try {
      setPreview(await previewAction({ csvText, projectId: requireProject() }));
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const handleImport = async () => {
    if (lock.current || !preview || preview.summary.matched === 0 || result) return;
    const reason = note.trim();
    if (reason.length < 3 || reason.length > 500) {
      setNoteError("Gerekçe 3–500 karakter olmalı.");
      return;
    }
    setNoteError("");
    setServerError("");
    lock.current = true;
    setPending(true);
    try {
      setResult(await importAction({ csvText, note: reason, projectId: requireProject() }));
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const rowErrors = result && Array.isArray(result.errors) ? result.errors : [];
  const errorCount = result
    ? typeof result.errors === "number" ? result.errors : result.errors.length
    : 0;
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-32px)] max-w-3xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDKS kayıtlarını içe aktar</DialogTitle>
          <DialogDescription>
            {activeProject?.name} projesine yazılır. Başlıklar: tcNo, tarih, giriş, çıkış, not.
            Tarih örneği: 2026-05-15; saat örneği: 09:00.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          {!preview && (
            <>
              <label className="block text-sm">
                CSV dosyası
                <input type="file" accept=".csv,text/csv" disabled={pending}
                  onChange={(event) => void handleFile(event)}
                  className="mt-1 block w-full min-w-0 text-sm" />
              </label>
              <a className="inline-block text-sm underline" download="pdks-ornek.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}>Örnek dosyayı indir</a>
              <Button variant="ghost" size="sm" disabled={pending}
                onClick={() => setCsvText(SAMPLE_CSV)}>Örnek doldur</Button>
              <label htmlFor="pdks-import-csv" className="block text-sm">CSV içeriği</label>
              <Textarea id="pdks-import-csv" value={csvText} disabled={pending}
                onChange={(event) => setCsvText(event.target.value)}
                className="min-h-[200px] font-mono text-xs md:text-xs" />
            </>
          )}
          {preview && (
            <>
              <p className="text-sm">
                Toplam: {preview.summary.total} · Eşleşen: {preview.summary.matched} ·
                Hatalı: {preview.summary.errors}
              </p>
              <ul className="max-h-60 divide-y overflow-y-auto border-y">
                {preview.rows.map((row) => (
                  <li key={row.index} className="break-words py-2 text-xs">
                    <span className="font-medium">Satır {row.index}: {row.matchedName || row.identifier}</span>
                    <span className="ml-2 text-muted-foreground">
                      {row.date} · {row.entryTime || "—"}–{row.exitTime || "—"}
                    </span>
                    {row.error && <p className="mt-1 text-danger">{errorMessage(row.error)}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!result && (
            <div>
              <label htmlFor="pdks-import-note" className="text-sm">Gerekçe (zorunlu)</label>
              <Textarea id="pdks-import-note" value={note} required minLength={3} maxLength={500}
                disabled={pending} rows={3} onChange={(event) => setNote(event.target.value)}
                aria-invalid={Boolean(noteError)}
                aria-describedby={noteError ? "pdks-import-note-help pdks-import-note-error" : "pdks-import-note-help"} />
              <p id="pdks-import-note-help" className="mt-1 text-xs text-muted-foreground">
                3–500 karakter. Tüm satırlara uygulanır; CSV satırındaki notun yerine kullanılır.
              </p>
              {noteError && <p id="pdks-import-note-error" role="alert" className="mt-1 text-xs text-danger">{noteError}</p>}
            </div>
          )}
          {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
          {result && (
            <div className="space-y-2">
              <p role="status" className="text-sm">
                İçe aktarım tamamlandı: {result.inserted} yeni, {result.updated} güncel, {errorCount} hata.
              </p>
              {rowErrors.length > 0 && (
                <ul aria-label="İçe aktarma hataları" className="max-h-60 space-y-2 overflow-y-auto text-sm text-danger">
                  {rowErrors.map((error) => <li key={error.index}>Satır {error.index}: {errorMessage(error.message)}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap">
          <Button variant="outline" disabled={pending} onClick={() => close(false)}>
            {result ? "Kapat" : "Vazgeç"}
          </Button>
          {preview && !result && <Button variant="ghost" disabled={pending}
            onClick={() => setPreview(null)}>Geri</Button>}
          {!result && <Button disabled={pending || (!preview ? !csvText.trim() : preview.summary.matched === 0)}
            onClick={() => void (preview ? handleImport() : handlePreview())}>
            {pending ? "İşleniyor…" : preview ? `${preview.summary.matched} satırı içe aktar` : "Önizle"}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
