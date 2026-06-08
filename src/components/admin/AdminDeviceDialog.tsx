import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";

interface AdminDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Super admin bir IDE Smart paneli UUID ile envantere (adminDevices) ekler.
 * Projeye atama Cihazlar → Havuzdan Ekle akışında yapılır.
 */
export function AdminDeviceDialog({ open, onClose, onSuccess }: AdminDeviceDialogProps) {
  const registerDevice = useMutation(api.adminDevices.register);

  const [ideUuid, setIdeUuid] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIdeUuid("");
      setName("");
      setSubmitting(false);
    }
  }, [open]);

  const handleRegister = async () => {
    const trimmed = ideUuid.trim();
    if (!trimmed) {
      toast({ title: "Hata", description: "Panel UUID gerekli", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await registerDevice({ ideUuid: trimmed, name: name.trim() || undefined });
      toast({ title: "Başarılı", description: "Cihaz envantere eklendi" });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz eklenemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent size="lg" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>Envantere Cihaz Ekle</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-sm text-muted-foreground">
            Cihaz envantere eklendikten sonra Cihazlar sayfasından projeye atanabilir.
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Panel UUID</Label>
              <Input
                autoFocus
                value={ideUuid}
                onChange={(e) => setIdeUuid(e.target.value)}
                placeholder="ör. 289833329732592 (panelin SYSTEM.UUID'i — src-id)"
              />
              <p className="text-xs text-muted-foreground">
                Panelin gerçek MQTT kimliği (15 haneli). Seri no DEĞİL.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cihaz Adı (opsiyonel)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Boş bırakılırsa UUID kullanılır"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                İptal
              </Button>
              <Button onClick={handleRegister} disabled={submitting || !ideUuid.trim()}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Envantere Ekle
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
