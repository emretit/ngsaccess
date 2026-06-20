import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { BrandPickerStep } from "@/components/devices/BrandPickerStep";
import { DeviceApiTokenCard } from "@/components/devices/DeviceApiTokenCard";
import { ServerDevice } from "@/types/device";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Loader2 } from "lucide-react";
import { BRAND_LABELS, type DeviceBrand } from "./hooks/useDeviceFormSchema";

interface DeviceDetailsPanelProps {
  open: boolean;
  onClose: () => void;
  selectedDevice: ServerDevice | null;
  onSuccess: () => void;
}

type Step = "picker" | "form";

export function DeviceDetailsPanel({ open, onClose, selectedDevice, onSuccess }: DeviceDetailsPanelProps) {
  const projectsData = useQuery(api.projects.list);
  const projectsLoading = projectsData === undefined;
  const projects = (projectsData ?? []).map((p: { _id: string; name: string }) => ({ _id: p._id as never, name: p.name }));

  // Yeni cihazda picker ile başla; edit'te direkt form.
  const [step, setStep] = useState<Step>(selectedDevice ? "form" : "picker");
  const [pickedBrand, setPickedBrand] = useState<DeviceBrand>("other");

  useEffect(() => {
    if (open) {
      setStep(selectedDevice ? "form" : "picker");
      setPickedBrand(selectedDevice?.brand ?? "other");
    }
  }, [open, selectedDevice]);

  // Edit'te brand'i async pickedBrand state'ini beklemeden DOĞRUDAN cihazdan al. Aksi halde
  // form ilk render'da "other" layout'uyla kurulup pickedBrand "hikvision"a geçince layout
  // yeniden kuruluyor; bu yarış anında çağrılan form.reset değerleri Select'lere (Cihaz Tipi,
  // Kapı Sayısı, İletişim Yöntemi) yapışmadan kayboluyordu. Yeni cihazda picker'ın seçtiği
  // pickedBrand kullanılır.
  const brandForForm: DeviceBrand = selectedDevice?.brand ?? pickedBrand;

  const handleBrandSelect = (brand: DeviceBrand) => {
    setPickedBrand(brand);
    setStep("form");
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent size="lg" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>
              {selectedDevice
                ? "Cihazı Düzenle"
                : step === "picker"
                  ? "Yeni Cihaz"
                  : `Yeni Cihaz — ${BRAND_LABELS[brandForForm]}`}
            </SheetTitle>
          </SheetHeader>
        </div>

        {projectsLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-120px)]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Yükleniyor...</span>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-6 space-y-6">
              {step === "picker" && !selectedDevice ? (
                <BrandPickerStep onSelect={handleBrandSelect} onCancel={onClose} />
              ) : (
                <>
                  <DeviceForm
                    key={selectedDevice?._id ?? "new"}
                    open={open}
                    device={selectedDevice}
                    projects={projects}
                    defaultBrand={brandForForm}
                    onBack={selectedDevice ? undefined : () => setStep("picker")}
                    onSuccess={onSuccess}
                    onClose={onClose}
                  />
                  {selectedDevice && (
                    <DeviceApiTokenCard
                      deviceId={selectedDevice._id}
                      currentToken={selectedDevice.apiToken}
                      currentTokenCreatedAt={selectedDevice.apiTokenCreatedAt}
                    />
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
