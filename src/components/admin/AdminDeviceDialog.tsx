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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

const NO_PROJECT = "__none__";

type AdminDevice = FunctionReturnType<typeof api.adminDevices.list>[number];

interface AdminDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Verilirse düzenleme modu: UUID kilitli, isim + proje atama güncellenir. */
  device?: AdminDevice | null;
}

/**
 * Super admin bir IDE Smart paneli UUID ile envantere (adminDevices) ekler veya
 * mevcut bir kaydı düzenler (isim + proje atama). Proje değişimi yıkıcıdır
 * (reassignDevice): atanmış cihaz mevcut projeden sökülüp hedefe yeniden atanır.
 */
export function AdminDeviceDialog({ open, onClose, onSuccess, device }: AdminDeviceDialogProps) {
  const registerDevice = useMutation(api.adminDevices.register);
  const claimDevice = useMutation(api.devices.claimDevice);
  const reassignDevice = useMutation(api.devices.reassignDevice);
  const projects = useQuery(api.projects.list, open ? {} : "skip");

  const isEdit = !!device;

  const [ideUuid, setIdeUuid] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIdeUuid(device?.ideUuid ?? "");
      setName(device?.name ?? "");
      setProjectId(device?.assignedProjectId ?? NO_PROJECT);
      setSubmitting(false);
    }
  }, [open, device]);

  const handleCreate = async () => {
    const trimmed = ideUuid.trim();
    if (!trimmed) {
      toast({ title: "Hata", description: "Panel UUID gerekli", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const adminDeviceId = await registerDevice({
        ideUuid: trimmed,
        name: name.trim() || undefined,
      });
      if (projectId !== NO_PROJECT) {
        // Proje seçildiyse cihazı doğrudan o projeye ata; bölge panel adıyla
        // otomatik oluşur (claimDevice zone vermeden de çalışır).
        await claimDevice({
          adminDeviceId,
          projectId: projectId as Id<"projects">,
          name: name.trim() || undefined,
        });
        toast({ title: "Başarılı", description: "Cihaz eklendi ve projeye atandı" });
      } else {
        toast({ title: "Başarılı", description: "Cihaz envantere eklendi" });
      }
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz eklenemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!device) return;
    const targetProjectId = projectId === NO_PROJECT ? undefined : (projectId as Id<"projects">);
    const projectChanged = (device.assignedProjectId ?? null) !== (targetProjectId ?? null);

    // Proje değişimi atanmış cihazda yıkıcı: kapılar + okuma geçmişi silinir.
    if (projectChanged && device.assignedDeviceId) {
      const warn = targetProjectId
        ? "Projeyi değiştirmek için cihaz mevcut projeden çıkarılacak (kapıları ve kart okuma geçmişi silinir), ardından yeni projeye atanacak. Devam edilsin mi?"
        : "Cihaz mevcut projeden çıkarılacak: kapıları ve kart okuma geçmişi silinir. Devam edilsin mi?";
      if (!confirm(warn)) return;
    }

    setSubmitting(true);
    try {
      await reassignDevice({
        adminDeviceId: device._id,
        projectId: targetProjectId,
        name: name.trim() || undefined,
      });
      toast({ title: "Başarılı", description: "Cihaz güncellendi" });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz güncellenemedi";
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
            <SheetTitle>{isEdit ? "Cihazı Düzenle" : "Envantere Cihaz Ekle"}</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? "İsmi ve proje atamasını değiştirin. Proje değişimi atanmış cihazda kapıları ve okuma geçmişini siler."
              : "Cihaz envantere eklendikten sonra Cihazlar sayfasından projeye atanabilir."}
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Panel UUID</Label>
              <Input
                autoFocus={!isEdit}
                disabled={isEdit}
                value={ideUuid}
                onChange={(e) => setIdeUuid(e.target.value)}
                placeholder="ör. 289833329732592 (panelin SYSTEM.UUID'i — src-id)"
              />
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? "Panel kimliği değiştirilemez."
                  : "Panelin gerçek MQTT kimliği (15 haneli). Seri no DEĞİL."}
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

            <div className="space-y-2">
              <Label>Proje (opsiyonel)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Projeye atamadan envantere ekle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Atama yok (havuzda kalsın)</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Proje seçilirse cihaz doğrudan atanır; boş bırakılırsa havuzda kalır.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                İptal
              </Button>
              <Button
                onClick={isEdit ? handleEdit : handleCreate}
                disabled={submitting || (!isEdit && !ideUuid.trim())}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? "Kaydet" : "Envantere Ekle"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
