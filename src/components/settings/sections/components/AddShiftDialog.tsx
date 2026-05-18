import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { shiftFormSchema, type ShiftFormValues } from "./shiftFormSchema";
import type { Id } from "../../../../../convex/_generated/dataModel";

export interface ShiftFormPayload {
  name: string;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  lateToleranceMinutes?: number;
  earlyExitToleranceMinutes?: number;
  overtimeStartToleranceMinutes?: number;
  overtimeEnabled: boolean;
  isActive: boolean;
}

export interface EditingShift extends ShiftFormPayload {
  _id: Id<"shifts">;
}

interface AddShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (shift: ShiftFormPayload) => Promise<void> | void;
  onUpdate: (id: Id<"shifts">, shift: ShiftFormPayload) => Promise<void> | void;
  editingShift: EditingShift | null;
  onClose: () => void;
}

const EMPTY_FORM: ShiftFormValues = {
  name: "",
  startTime: "",
  endTime: "",
  breakStart: "",
  breakEnd: "",
  lateToleranceMinutes: undefined,
  earlyExitToleranceMinutes: undefined,
  overtimeStartToleranceMinutes: undefined,
  overtimeEnabled: true,
  isActive: true,
};

function computeDuration(start: string, end: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

export function AddShiftDialog({
  open,
  onOpenChange,
  onAdd,
  onUpdate,
  editingShift,
  onClose,
}: AddShiftDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ShiftFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [breakEnabled, setBreakEnabled] = useState(false);

  useEffect(() => {
    if (editingShift) {
      setFormData({
        name: editingShift.name,
        startTime: editingShift.startTime,
        endTime: editingShift.endTime,
        breakStart: editingShift.breakStart ?? "",
        breakEnd: editingShift.breakEnd ?? "",
        lateToleranceMinutes: editingShift.lateToleranceMinutes,
        earlyExitToleranceMinutes: editingShift.earlyExitToleranceMinutes,
        overtimeStartToleranceMinutes: editingShift.overtimeStartToleranceMinutes,
        overtimeEnabled: editingShift.overtimeEnabled ?? true,
        isActive: editingShift.isActive,
      });
      setBreakEnabled(Boolean(editingShift.breakStart && editingShift.breakEnd));
    } else {
      setFormData(EMPTY_FORM);
      setBreakEnabled(false);
    }
  }, [editingShift, open]);

  const duration = computeDuration(formData.startTime, formData.endTime);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate: ShiftFormValues = {
      ...formData,
      ...(breakEnabled ? {} : { breakStart: "", breakEnd: "" }),
    };
    const result = shiftFormSchema.safeParse(candidate);
    if (!result.success) {
      const first = result.error.issues[0];
      toast({
        title: "Hatalı form",
        description: first?.message ?? "Lütfen alanları kontrol edin",
        variant: "destructive",
      });
      return;
    }

    const payload: ShiftFormPayload = {
      name: result.data.name,
      startTime: result.data.startTime,
      endTime: result.data.endTime,
      breakStart: result.data.breakStart || undefined,
      breakEnd: result.data.breakEnd || undefined,
      lateToleranceMinutes: result.data.lateToleranceMinutes,
      earlyExitToleranceMinutes: result.data.earlyExitToleranceMinutes,
      overtimeStartToleranceMinutes: result.data.overtimeStartToleranceMinutes,
      overtimeEnabled: result.data.overtimeEnabled,
      isActive: result.data.isActive,
    };

    setSubmitting(true);
    try {
      if (editingShift) {
        await onUpdate(editingShift._id, payload);
      } else {
        await onAdd(payload);
      }
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(EMPTY_FORM);
    setBreakEnabled(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle>
            {editingShift ? "Vardiya Düzenle" : "Yeni Vardiya"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          id="shift-form"
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
        >
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Vardiya Adı *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn: Sabah Vardiyası"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-sm font-medium text-foreground">
                  Başlangıç Saati *
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-sm font-medium text-foreground">
                  Bitiş Saati *
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lateTolerance" className="text-sm font-medium text-foreground">
                  Geç Tolerans (dk)
                </Label>
                <Input
                  id="lateTolerance"
                  type="number"
                  min={0}
                  max={240}
                  value={formData.lateToleranceMinutes ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lateToleranceMinutes:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="Global"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="earlyTolerance" className="text-sm font-medium text-foreground">
                  Erken Çıkış Tolerans (dk)
                </Label>
                <Input
                  id="earlyTolerance"
                  type="number"
                  min={0}
                  max={240}
                  value={formData.earlyExitToleranceMinutes ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      earlyExitToleranceMinutes:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="Global"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="overtimeTolerance" className="text-sm font-medium text-foreground">
                  Mesai Başlangıç Toleransı (dk)
                </Label>
                <Input
                  id="overtimeTolerance"
                  type="number"
                  min={0}
                  max={240}
                  value={formData.overtimeStartToleranceMinutes ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      overtimeStartToleranceMinutes:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="Global"
                  disabled={!formData.overtimeEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Vardiya bitiminden sonra bu süre içindeki çıkış mesai sayılmaz. Boşsa global ayar kullanılır.
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="overtimeEnabled" className="text-sm font-medium text-foreground">
                    Mesai etkin
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Kapalıyken bu vardiyaya bağlı PDKS kayıtlarında mesai hesaplanmaz (hafta sonu ve tatil dahil).
                  </p>
                </div>
                <Switch
                  id="overtimeEnabled"
                  checked={formData.overtimeEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, overtimeEnabled: checked })
                  }
                />
              </div>
              <Link
                to="/settings?tab=work-payroll"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Mesai ve tatil ayarları
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {duration && (
              <p className="text-xs text-muted-foreground">
                Toplam süre: <span className="font-medium">{duration}</span>
              </p>
            )}

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="breakEnabled" className="text-sm font-medium text-foreground">
                    Mola
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Vardiya içinde mola saati tanımla.
                  </p>
                </div>
                <Switch
                  id="breakEnabled"
                  checked={breakEnabled}
                  onCheckedChange={setBreakEnabled}
                />
              </div>
              {breakEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="breakStart" className="text-xs font-medium text-foreground">
                      Mola Başlangıç
                    </Label>
                    <Input
                      id="breakStart"
                      type="time"
                      value={formData.breakStart ?? ""}
                      onChange={(e) => setFormData({ ...formData, breakStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="breakEnd" className="text-xs font-medium text-foreground">
                      Mola Bitiş
                    </Label>
                    <Input
                      id="breakEnd"
                      type="time"
                      value={formData.breakEnd ?? ""}
                      onChange={(e) => setFormData({ ...formData, breakEnd: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-sm font-medium text-foreground">
                  Aktif
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pasif vardiyalar atamalar için gizlenir.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
        </form>

        <DialogFooter className="px-6 py-3 border-t bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            İptal
          </Button>
          <Button type="submit" form="shift-form" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {editingShift ? "Güncelleniyor..." : "Oluşturuluyor..."}
              </>
            ) : editingShift ? (
              "Güncelle"
            ) : (
              "Oluştur"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
