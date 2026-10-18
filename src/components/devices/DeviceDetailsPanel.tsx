import { useCallback, useEffect, useState } from "react";
import { useActiveProject, useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../../convex/_generated/dataModel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DeviceForm } from "./DeviceForm";
import { BrandPickerStep } from "./BrandPickerStep";
import { DeviceApiTokenCard } from "./DeviceApiTokenCard";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ServerDevice } from "@/types/device";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BRAND_LABELS, type DeviceBrand } from "./hooks/useDeviceFormSchema";

interface DeviceDetailsPanelProps { open: boolean; onClose: () => void; selectedDevice: ServerDevice | null; onSuccess: () => void; projectId: Id<"projects"> | undefined; }
export function DeviceDetailsPanel({ open, onClose, selectedDevice, onSuccess, projectId: draftProjectId }: DeviceDetailsPanelProps) {
  const { projectId } = useActiveProject();
  const projectChanged = open && projectId !== draftProjectId;
  const projects = useQuery(api.projects.list, open ? {} : "skip");
  const [commandPending, setCommandPending] = useState(false);
  const [step, setStep] = useState<"picker" | "form">("picker");
  const [brand, setBrand] = useState<DeviceBrand>("other");
  const [draftBrands, setDraftBrands] = useState<DeviceBrand[]>([]);
  const [formStates, setFormStates] = useState<Partial<Record<DeviceBrand, { dirty: boolean; pending: boolean }>>>({});
  const updateFormState = useCallback((brand: DeviceBrand, dirty: boolean, pending: boolean) => {
    setFormStates(current => current[brand]?.dirty === dirty && current[brand]?.pending === pending ? current : { ...current, [brand]: { dirty, pending } });
  }, []);
  useEffect(() => {
    if (!open) return;
    setStep(selectedDevice ? "form" : "picker");
    setBrand(selectedDevice?.brand ?? "other");
    setDraftBrands([]);
    setFormStates({});
    setCommandPending(false);
  }, [open, selectedDevice]);
  const pending = commandPending || Object.values(formStates).some(state => state?.pending);
  const dirty = Object.values(formStates).some(state => state?.dirty);
  const guard = useUnsavedChangesGuard(open && dirty);
  useProjectChangeGuard(open && (dirty || pending), pending ? () => {} : guard.requestClose);
  useEffect(() => {
    if (projectChanged) onClose();
  }, [projectChanged, onClose]);
  const close = () => { if (!pending) guard.requestClose(onClose); };
  const pickBrand = (value: DeviceBrand) => { setBrand(value); setDraftBrands(current => current.includes(value) ? current : [...current, value]); setStep("form"); };
  return <>
    <Sheet open={open} onOpenChange={next => { if (!next) close(); }}>
      <SheetContent size="full" className="w-full sm:max-w-[620px] min-w-0 overflow-y-auto p-0">
        <SheetHeader className="border-b border-line p-5 pr-12 text-left"><SheetTitle className="break-words">{selectedDevice?.name ?? (step === "picker" ? "Yeni cihaz" : `Yeni cihaz · ${BRAND_LABELS[brand]}`)}</SheetTitle></SheetHeader>
        <fieldset disabled={projectChanged} onSubmitCapture={event => { if (projectChanged) { event.preventDefault(); event.stopPropagation(); } }} className="min-w-0 p-5">
          {projects === undefined || !draftProjectId ? <SectionSkeleton label="Cihaz bilgileri yükleniyor" /> : selectedDevice ? (
            <Tabs key={selectedDevice._id} defaultValue="overview" className="min-w-0 space-y-5">
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="overview">Genel bakış</TabsTrigger><TabsTrigger value="settings">Ayarlar</TabsTrigger></TabsList>
              <TabsContent value="overview" forceMount className="data-[state=inactive]:hidden"><QuerySectionBoundary resetKey={selectedDevice._id}><DeviceCommandCenter device={selectedDevice} onPendingChange={setCommandPending} /></QuerySectionBoundary></TabsContent>
              <TabsContent value="settings" forceMount className="space-y-5 data-[state=inactive]:hidden">
                <DeviceForm projectIdOverride={draftProjectId} open={open} device={selectedDevice} projects={projects} defaultBrand={selectedDevice.brand ?? "other"} onSuccess={onSuccess} onClose={close} onStateChange={updateFormState} />
                <DeviceApiTokenCard key={selectedDevice._id} deviceId={selectedDevice._id} deviceName={selectedDevice.name} currentToken={selectedDevice.apiToken} currentTokenCreatedAt={selectedDevice.apiTokenCreatedAt} />
              </TabsContent>
            </Tabs>
          ) : <>
            {step === "picker" && <BrandPickerStep onSelect={pickBrand} onCancel={close} />}
            {draftBrands.map(draftBrand => <div key={draftBrand} hidden={step !== "form" || draftBrand !== brand}>
              <DeviceForm projectIdOverride={draftProjectId} open={open} device={null} projects={projects} defaultBrand={draftBrand} onBack={() => setStep("picker")} onSuccess={onSuccess} onClose={close} onStateChange={updateFormState} />
            </div>)}
          </>}
        </fieldset>
      </SheetContent>
    </Sheet>
    {guard.dialog}
  </>;
}
