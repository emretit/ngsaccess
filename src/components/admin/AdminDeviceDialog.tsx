import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { BrandPickerStep } from "@/components/devices/BrandPickerStep";
import { BRAND_LABELS, type DeviceBrand } from "@/components/devices/hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";

interface AdminDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Düzenleme modu; null/undefined ise yeni cihaz. */
  device?: ServerDevice | null;
  onSuccess: () => void;
}

type Step = "project" | "picker" | "form";

/**
 * Admin cihaz ekleme/düzenleme: super admin cihazı istediği projeye atar.
 * Yeni cihaz akışı: proje seç → marka seç → form (cihaz seçilen projeye yazılır).
 * Düzenlemede proje değiştirilemez (update projectId almaz), direkt form açılır.
 */
export function AdminDeviceDialog({ open, onClose, device, onSuccess }: AdminDeviceDialogProps) {
  const projectsData = useQuery(api.projects.list);
  const projectsLoading = projectsData === undefined;
  const projects = (projectsData ?? []).map((p) => ({ _id: p._id, name: p.name }));

  const [step, setStep] = useState<Step>(device ? "form" : "project");
  const [pickedBrand, setPickedBrand] = useState<DeviceBrand>("other");
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(device?.projectId ?? null);

  useEffect(() => {
    if (open) {
      setStep(device ? "form" : "project");
      setPickedBrand(device?.brand ?? "other");
      setProjectId(device?.projectId ?? null);
    }
  }, [open, device]);

  const selectedProjectName = projects.find((p) => p._id === projectId)?.name ?? "";

  const title = device
    ? "Cihazı Düzenle"
    : step === "project"
      ? "Yeni Cihaz — Proje Seç"
      : step === "picker"
        ? "Yeni Cihaz — Marka Seç"
        : `Yeni Cihaz — ${BRAND_LABELS[pickedBrand]}`;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent size="lg" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          {!device && projectId && step !== "project" && (
            <p className="mt-1 text-sm text-muted-foreground">Proje: {selectedProjectName}</p>
          )}
        </div>

        {projectsLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-120px)]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-6 space-y-6">
              {step === "project" && !device ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Proje</Label>
                    <Select
                      value={projectId ?? undefined}
                      onValueChange={(v) => setProjectId(v as Id<"projects">)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Cihazın atanacağı projeyi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Cihaz seçilen projeye atanır. Super admin tüm projeleri görür.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>İptal</Button>
                    <Button disabled={!projectId} onClick={() => setStep("picker")}>Devam</Button>
                  </div>
                </div>
              ) : step === "picker" && !device ? (
                <BrandPickerStep
                  onSelect={(b) => { setPickedBrand(b); setStep("form"); }}
                  onCancel={onClose}
                />
              ) : (
                <DeviceForm
                  open={open}
                  device={device}
                  projects={projects}
                  defaultBrand={pickedBrand}
                  projectIdOverride={projectId}
                  adminMode
                  onBack={device ? undefined : () => setStep("picker")}
                  onSuccess={onSuccess}
                  onClose={onClose}
                />
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
