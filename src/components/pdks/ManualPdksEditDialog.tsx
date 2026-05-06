import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  employeeId: Id<"employees">;
  employeeName: string;
  date: string; // YYYY-MM-DD
  initialEntry: string;
  initialExit: string;
  onClose: () => void;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTime(v: string): string {
  // "08:30" formatına dönüştür (locale string'i de kabul et)
  if (HHMM.test(v)) return v;
  const m = v.match(/(\d{1,2})[:.](\d{2})/);
  if (m) {
    const h = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, "0");
    const min = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, "0");
    return `${h}:${min}`;
  }
  return v;
}

export function ManualPdksEditDialog({
  open,
  employeeId,
  employeeName,
  date,
  initialEntry,
  initialExit,
  onClose,
}: Props) {
  const [entryTime, setEntryTime] = useState(normalizeTime(initialEntry));
  const [exitTime, setExitTime] = useState(normalizeTime(initialExit));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const upsert = useMutation(api.pdksRecords.upsertManual);

  useEffect(() => {
    if (open) {
      setEntryTime(normalizeTime(initialEntry));
      setExitTime(normalizeTime(initialExit));
      setNote("");
    }
  }, [open, initialEntry, initialExit]);

  const handleSave = async () => {
    if (entryTime && !HHMM.test(entryTime)) {
      toast({
        title: "Geçersiz giriş saati",
        description: "Format: HH:MM (örn 08:30)",
        variant: "destructive",
      });
      return;
    }
    if (exitTime && !HHMM.test(exitTime)) {
      toast({
        title: "Geçersiz çıkış saati",
        description: "Format: HH:MM (örn 17:45)",
        variant: "destructive",
      });
      return;
    }
    if (entryTime && exitTime && entryTime >= exitTime) {
      toast({
        title: "Saatler tutarsız",
        description: "Çıkış, girişten sonra olmalı.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await upsert({
        employeeId,
        date,
        entryTime: entryTime || undefined,
        exitTime: exitTime || undefined,
        note: note.trim() || undefined,
      });
      toast({
        title: "Manuel kayıt güncellendi",
        description: `${employeeName} — ${date}`,
      });
      onClose();
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Kayıt başarısız",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manuel PDKS Düzeltmesi</DialogTitle>
          <DialogDescription>
            {employeeName} — {date}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 flex gap-2 text-sm text-orange-900">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>
            Bu kayıt manuel olarak düzenlenecek ve denetim kaydına işlenecektir.
            Çalışan kart okumaları korunur; yalnızca puantaj hesabı bu girdileri
            kullanır.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry">Giriş saati</Label>
              <Input
                id="entry"
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit">Çıkış saati</Label>
              <Input
                id="exit"
                type="time"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Açıklama (zorunlu değil)</Label>
            <Textarea
              id="note"
              placeholder="Sebep / kaynak"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
