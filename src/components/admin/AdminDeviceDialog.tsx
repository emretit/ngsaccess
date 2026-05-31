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
import { DeviceForm } from "@/components/devices/DeviceForm";
import type { ServerDevice } from "@/types/device";
import { toast } from "@/hooks/use-toast";

interface AdminDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Düzenleme modu; null/undefined ise yeni cihaz (havuza UUID ile ekle). */
  device?: ServerDevice | null;
  onSuccess: () => void;
}

/**
 * Admin cihaz yönetimi (super_admin):
 * - Yeni cihaz: IDE Smart paneli UUID ile HAVUZA ekler (atanmamış; projectId yok). Ortak
 *   varsayılan MQTT kimliği backend'de otomatik uygulanır. Projeye atama Cihazlar'da claim ile.
 *   (Havuz şimdilik IDE-Smart only; Hikvision kendi gateway akışında.)
 * - Düzenleme: mevcut cihazın bağlantı alanları (DeviceForm adminMode).
 */
export function AdminDeviceDialog({ open, onClose, device, onSuccess }: AdminDeviceDialogProps) {
  const registerPanel = useMutation(api.devices.registerUnassignedPanel);

  const [ideUuid, setIdeUuid] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && !device) {
      setIdeUuid("");
      setName("");
      setSubmitting(false);
    }
  }, [open, device]);

  const handleRegister = async () => {
    const trimmed = ideUuid.trim();
    if (!trimmed) {
      toast({ title: "Hata", description: "Panel UUID gerekli", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // brand omit → backend ide_smart varsayar (havuz IDE-only).
      await registerPanel({ ideUuid: trimmed, name: name.trim() || undefined });
      toast({ title: "Başarılı", description: "Cihaz havuza eklendi (atanmamış)" });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz eklenemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const title = device ? "Cihazı Düzenle" : "Havuza Cihaz Ekle (UUID ile)";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent size="lg" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-6 space-y-6">
            {device ? (
              // Düzenleme: mevcut bağlantı alanları (adminMode). Proje değiştirilmez.
              <DeviceForm
                open={open}
                device={device}
                projects={[]}
                defaultBrand={device.brand ?? "ide_smart"}
                projectIdOverride={device.projectId ?? null}
                adminMode
                onSuccess={onSuccess}
                onClose={onClose}
              />
            ) : (
              // Yeni: UUID ile havuza ekle. Kimlik (ideUser/idePassword) ortak varsayılandan
              // backend'de uygulanır — burada girilmez. Proje yok → claim Cihazlar'da.
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Panel UUID</Label>
                  <Input
                    autoFocus
                    value={ideUuid}
                    onChange={(e) => setIdeUuid(e.target.value)}
                    placeholder="ör. 289833329732592 (panelin SYSTEM.UUID'i — src-id)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Panelin gerçek MQTT kimliği (15 haneli). Seri no DEĞİL. Panel önceden Hetzner
                    broker'ına ayarlı geldiği için, eklenince bağlanınca otomatik canlanır.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>İsim (opsiyonel)</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Boş bırakılırsa UUID kullanılır"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} disabled={submitting}>İptal</Button>
                  <Button onClick={handleRegister} disabled={submitting || !ideUuid.trim()}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Havuza Ekle
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
