import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useCallback, useEffect, useState } from "react";
import {
  useActiveProject,
  useProjectChangeGuard,
} from "@/contexts/ActiveProjectContext";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

interface DeviceDetailsPanelProps {
  open: boolean;
  deviceUnavailable?: boolean;
  onClose: () => void;
  deviceId?: Id<"devices">;
  selectedDevice: ServerDevice | null;
  onSuccess: () => void;
  projectId: Id<"projects"> | undefined;
}
export function DeviceDetailsPanel({
  open,
  deviceUnavailable = false,
  onClose,
  selectedDevice,
  deviceId: requestedId,
  onSuccess,
  projectId: draftProjectId,
}: DeviceDetailsPanelProps) {
  const { projectId } = useActiveProject();
  const { isAdmin } = useProjectAccess();
  const deviceId = requestedId ?? selectedDevice?._id;
  const liveDevice = useQuery(
    api.deviceCenter.getOverview,
    open && deviceId ? { deviceId } : "skip",
  );
  const currentDevice = liveDevice?.device ?? selectedDevice;
  const initialBrand = selectedDevice?.brand ?? "other";
  const projectChanged = open && projectId !== draftProjectId;
  const [tab, setTab] = useState("overview");
  const [step, setStep] = useState<"picker" | "form">("picker");
  const [settingsVisited, setSettingsVisited] = useState(false);
  const needsProjects = open && (!selectedDevice || settingsVisited);
  const projects = useQuery(api.projects.list, needsProjects ? {} : "skip");
  const [commandPending, setCommandPending] = useState(false);
  const [brand, setBrand] = useState<DeviceBrand>("other");
  const [draftBrands, setDraftBrands] = useState<DeviceBrand[]>([]);
  const [formStates, setFormStates] = useState<
    Partial<Record<DeviceBrand, { dirty: boolean; pending: boolean }>>
  >({});
  const updateFormState = useCallback(
    (brand: DeviceBrand, dirty: boolean, pending: boolean) => {
      setFormStates((current) =>
        current[brand]?.dirty === dirty && current[brand]?.pending === pending
          ? current
          : { ...current, [brand]: { dirty, pending } },
      );
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    setStep(deviceId ? "form" : "picker");
    setBrand(initialBrand);
    setDraftBrands([]);
    setFormStates({});
    setCommandPending(false);
    setSettingsVisited(false);
    setTab("overview");
  }, [open, deviceId, initialBrand]);
  const pending =
    commandPending || Object.values(formStates).some((state) => state?.pending);
  const dirty = Object.values(formStates).some((state) => state?.dirty);
  const guard = useUnsavedChangesGuard(open && dirty);
  useProjectChangeGuard(
    open && (dirty || pending),
    pending ? () => {} : guard.requestClose,
  );
  useEffect(() => {
    if (projectChanged) onClose();
  }, [projectChanged, onClose]);
  const close = () => {
    if (!pending) guard.requestClose(onClose);
  };
  const pickBrand = (value: DeviceBrand) => {
    setBrand(value);
    setDraftBrands((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setStep("form");
  };
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <SheetContent
          size="lg"
          className="flex w-full min-w-0 flex-col gap-0 p-0 sm:w-[700px] sm:max-w-[700px] md:max-w-[700px] [&>button]:min-h-11 [&>button]:min-w-11"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 border-b border-line p-5 pr-12 text-left">
            <SheetTitle className="break-words">
              {currentDevice?.name ??
                (step === "picker"
                  ? "Yeni cihaz"
                  : `Yeni cihaz · ${BRAND_LABELS[brand]}`)}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Cihaz bağlantısı, kapılar, işlemler ve ayarlar.
            </SheetDescription>
          </SheetHeader>
          <fieldset
            disabled={projectChanged || deviceUnavailable}
            onSubmitCapture={(event) => {
              if (projectChanged) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            {deviceUnavailable ? (
              <p role="alert" className="p-5 text-sm">
                Cihaz artık bu projede bulunmuyor. Paneli kapatıp cihaz listesini kontrol edin.
              </p>
            ) : !draftProjectId ? (
              <SectionSkeleton label="Cihaz bilgileri yükleniyor" />
            ) : selectedDevice ? (
              <Tabs
                key={selectedDevice._id}
                value={tab}
                onValueChange={(value) => {
                  setTab(value);
                  if (value === "settings") setSettingsVisited(true);
                }}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <TabsList className="mx-5 my-3 grid min-h-11 shrink-0 grid-cols-2 [&_button]:min-h-11">
                  <TabsTrigger value="overview">Genel bakış</TabsTrigger>
                  <TabsTrigger value="settings">Ayarlar</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="overview"
                  forceMount
                  className="min-h-0 flex-1 overflow-y-auto p-5 data-[state=inactive]:hidden"
                >
                  <QuerySectionBoundary resetKey={selectedDevice._id}>
                    <DeviceCommandCenter
                      deviceId={selectedDevice._id}
                      onPendingChange={setCommandPending}
                    />
                  </QuerySectionBoundary>
                </TabsContent>
                {settingsVisited && (
                  <TabsContent
                    value="settings"
                    forceMount
                    className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-5 pb-0 data-[state=inactive]:hidden"
                  >
                    {!isAdmin && (
                      <p
                        id="device-readonly-reason"
                        className="text-sm text-muted-foreground"
                      >
                        Cihaz ayarları salt okunur. Değişiklik yapmak için
                        yönetici yetkisi gerekir.
                      </p>
                    )}
                    {projects === undefined ? (
                      <SectionSkeleton label="Cihaz ayarları yükleniyor" />
                    ) : (
                      <DeviceForm
                        projectIdOverride={draftProjectId}
                        open={open}
                        device={selectedDevice}
                        disabled={!isAdmin}
                        projects={projects}
                        defaultBrand={selectedDevice.brand ?? "other"}
                        onSuccess={() => {
                          setTab("overview");
                          setFormStates({});
                        }}
                        onClose={close}
                        onStateChange={updateFormState}
                      />
                    )}
                    {isAdmin && (
                      <DeviceApiTokenCard
                        key={selectedDevice._id}
                        deviceId={selectedDevice._id}
                        deviceName={selectedDevice.name}
                        currentToken={selectedDevice.apiToken}
                        currentTokenCreatedAt={selectedDevice.apiTokenCreatedAt}
                      />
                    )}
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-0">
                {step === "picker" && (
                  <BrandPickerStep onSelect={pickBrand} onCancel={close} />
                )}
                {step === "form" && projects === undefined && (
                  <SectionSkeleton label="Cihaz bilgileri yükleniyor" />
                )}
                {projects !== undefined &&
                  draftBrands.map((draftBrand) => (
                    <div
                      key={draftBrand}
                      hidden={step !== "form" || draftBrand !== brand}
                    >
                      <DeviceForm
                        projectIdOverride={draftProjectId}
                        open={open}
                        device={null}
                        projects={projects ?? []}
                        defaultBrand={draftBrand}
                        onBack={() => setStep("picker")}
                        onSuccess={onSuccess}
                        onClose={close}
                        onStateChange={updateFormState}
                      />
                    </div>
                  ))}
              </div>
            )}
          </fieldset>
        </SheetContent>
      </Sheet>
      {guard.dialog}
    </>
  );
}
