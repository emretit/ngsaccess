import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { shiftFormSchema, type ShiftFormValues } from "./shiftFormSchema";
import type { Id } from "../../../../../convex/_generated/dataModel";

export interface ShiftFormPayload {
  name: string;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
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
  isActive: true,
};

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

  useEffect(() => {
    if (editingShift) {
      setFormData({
        name: editingShift.name,
        startTime: editingShift.startTime,
        endTime: editingShift.endTime,
        breakStart: editingShift.breakStart ?? "",
        breakEnd: editingShift.breakEnd ?? "",
        isActive: editingShift.isActive,
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [editingShift, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = shiftFormSchema.safeParse(formData);
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
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="md" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>
              {editingShift ? "Vardiya Düzenle" : "Yeni Vardiya"}
            </SheetTitle>
          </SheetHeader>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <form onSubmit={handleSubmit} id="shift-form" className="p-6 space-y-5">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breakStart" className="text-sm font-medium text-foreground">
                  Mola Başlangıç
                </Label>
                <Input
                  id="breakStart"
                  type="time"
                  value={formData.breakStart ?? ""}
                  onChange={(e) => setFormData({ ...formData, breakStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakEnd" className="text-sm font-medium text-foreground">
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
        </ScrollArea>

        <div className="border-t bg-background p-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            İptal
          </Button>
          <Button
            type="submit"
            form="shift-form"
            className="bg-primary hover:bg-primary/90 text-white"
            disabled={submitting}
          >
            {editingShift ? "Güncelle" : "Kaydet"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
