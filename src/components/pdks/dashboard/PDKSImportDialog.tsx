import { useState } from "react";
import { useAction } from "convex/react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../../../convex/_generated/api";

interface PreviewRow {
  index: number;
  identifier: string;
  date: string;
  entryTime?: string;
  exitTime?: string;
  note?: string;
  matchedName?: string;
  employeeId?: string;
  error?: string;
}

interface PDKSImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_CSV = `tcNo,tarih,giris,cikis,not
12345678901,2026-05-15,09:00,18:00,Manuel düzeltme
98765432109,2026-05-15,08:30,17:30,`;

export function PDKSImportDialog({ open, onOpenChange }: PDKSImportDialogProps) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; summary: { total: number; matched: number; errors: number } } | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const previewAction = useAction(api.actions.pdksImport.previewPdksCsv);
  const importAction = useAction(api.actions.pdksImport.importPdksCsv);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => setCsvText(text));
  };

  const handlePreview = async () => {
    if (!csvText.trim()) {
      toast({ title: "CSV içeriği boş", variant: "destructive" });
      return;
    }
    try {
      const result = await previewAction({ csvText });
      setPreview(result);
    } catch (e) {
      toast({
        title: "CSV ön izleme hatası",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!preview || preview.summary.matched === 0) return;
    setImporting(true);
    try {
      const result = await importAction({ csvText });
      toast({
        title: "İçe aktarım tamamlandı",
        description: `${result.inserted} yeni, ${result.updated} güncel, ${result.errors} hata`,
      });
      setCsvText("");
      setPreview(null);
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "İçe aktarım hatası",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            PDKS CSV İçe Aktarımı
          </DialogTitle>
          <DialogDescription>
            CSV dosyası yükle veya yapıştır. Başlıklar: <code>tcNo, tarih, giris, cikis, not</code>.
            Tarih YYYY-MM-DD, saat HH:MM formatında.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
          {!preview && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  type="button"
                >
                  Örnek doldur
                </Button>
              </div>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="CSV içeriğini buraya yapıştırın..."
                className="font-mono text-xs flex-1 min-h-[200px]"
              />
            </>
          )}

          {preview && (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Toplam: {preview.summary.total}</Badge>
                <Badge variant="default" className="bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Eşleşen: {preview.summary.matched}
                </Badge>
                {preview.summary.errors > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Hata: {preview.summary.errors}
                  </Badge>
                )}
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-1">
                  {preview.rows.map((r) => (
                    <div
                      key={r.index}
                      className={`text-xs px-2 py-1 rounded ${
                        r.error
                          ? "bg-destructive/10 text-destructive"
                          : "bg-emerald-50 text-emerald-900"
                      }`}
                    >
                      <span className="font-mono">{r.identifier}</span>
                      {r.matchedName && (
                        <span className="ml-2 font-medium">→ {r.matchedName}</span>
                      )}
                      <span className="ml-2 text-muted-foreground">
                        {r.date} {r.entryTime ?? "—"}{r.exitTime ? `–${r.exitTime}` : ""}
                      </span>
                      {r.error && <span className="ml-2">⚠ {r.error}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          {!preview && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <Button onClick={handlePreview} disabled={!csvText.trim()}>
                Ön izle
              </Button>
            </>
          )}
          {preview && (
            <>
              <Button
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={importing}
              >
                Geri
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || preview.summary.matched === 0}
              >
                {importing
                  ? "İçe aktarılıyor..."
                  : `${preview.summary.matched} satırı içe aktar`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
