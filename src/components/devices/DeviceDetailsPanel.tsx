import { UNSAFE_NavigationContext } from "react-router-dom";
import { installNavigationGuard } from "@/lib/navigationGuard";
import { deviceConnection } from "@/lib/deviceStatus";
import { useNow } from "@/hooks/useNow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { deviceBrandLabel } from "@/lib/deviceBrand";
import { deviceConnectionBadge } from "./hooks/deviceConnectionBadge";
import { DeviceGatewayDanger } from "./DeviceGatewayDanger";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
  const clock = useNow(15_000);
  const connectionStatus = liveDevice?.device ? deviceConnection(liveDevice.device, clock) : selectedDevice?.connectionStatus;
  const initialBrand = selectedDevice?.brand ?? "other";
  const projectChanged = open && projectId !== draftProjectId;
  const [tab, setTab] = useState(isAdmin ? "settings" : "overview");
  const [step, setStep] = useState<"picker" | "form">("picker");
  const [settingsVisited, setSettingsVisited] = useState(isAdmin);
  const [operationsVisited, setOperationsVisited] = useState(!isAdmin);
  const needsProjects = open && (!selectedDevice || settingsVisited);
  const queriedProjects = useQuery(api.projects.list, needsProjects ? {} : "skip");
  const [projectCache, setProjectCache] = useState(queriedProjects);
  if (queriedProjects !== undefined && queriedProjects !== projectCache) setProjectCache(queriedProjects);
  // Kapanış animasyonunda ve yeniden açılışta son listeyi göster; iskelete dönme.
  const projects = queriedProjects ?? projectCache;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const [tokenPending, setTokenPending] = useState(false);
  const [gatewayPending, setGatewayPending] = useState(false);
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
  // Yalnız açılışta / başka cihaza geçişte sıfırla; açıkken rol yeniden çözülürse taslak ve dirty korunur.
  const resetKey = open ? `${deviceId ?? "new"}:${initialBrand}` : null;
  const lastResetKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    if (!resetKey) return;
    setStep(deviceId ? "form" : "picker");
    setBrand(initialBrand);
    setDraftBrands([]);
    setFormStates({});
    setCommandPending(false);
    setSettingsVisited(isAdmin);
    setOperationsVisited(!isAdmin);
    setTab(isAdmin ? "settings" : "overview");
  }, [resetKey, deviceId, initialBrand, isAdmin]);
  const pending =
    commandPending || tokenPending || gatewayPending || Object.values(formStates).some((state) => state?.pending);
  const dirty = Object.values(formStates).some((state) => state?.dirty);
  const guard = useUnsavedChangesGuard(open && dirty);
  const { requestClose } = guard;
  useProjectChangeGuard(
    open && (dirty || pending),
    pending ? () => {} : guard.requestClose,
  );
  useEffect(() => {
    if (projectChanged) onClose();
  }, [projectChanged, onClose]);
  useEffect(() => {
    if (!open || (!dirty && !pending)) return;
    return installNavigationGuard(navigator, proceed => {
      if (!pending) requestClose(proceed);
    }, window, pending);
  }, [open, dirty, pending, navigator, requestClose]);
  const formReady = projects !== undefined;
  useEffect(() => {
    if (open && !deviceId && step === "form" && formReady) {
      contentRef.current?.querySelector<HTMLInputElement>(`[data-device-brand="${brand}"] input[name="name"]`)?.focus();
    }
  }, [open, deviceId, step, brand, formReady]);
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
          ref={contentRef}
          onOpenAutoFocus={(event) => {
            if (!deviceId) return;
            event.preventDefault();
            titleRef.current?.focus();
          }}
          size="lg"
          className="flex w-full min-w-0 flex-col gap-0 p-0 sm:w-[700px] sm:max-w-[700px] md:max-w-[700px] max-sm:[&>button]:min-h-11 max-sm:[&>button]:min-w-11"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-line px-5 py-3 pr-12 text-left">
            <SheetTitle ref={titleRef} tabIndex={-1} className="break-words outline-none">
              {deviceId ? isAdmin ? "Cihaz düzenle" : "Cihaz ayrıntısı" : step === "picker" ? "Yeni cihaz" : `Yeni cihaz · ${BRAND_LABELS[brand]}`}
            </SheetTitle>
            {currentDevice && (
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate">{currentDevice.name}</span>
                <StatusBadge tone={deviceConnectionBadge(connectionStatus).tone}>{deviceConnectionBadge(connectionStatus).label}</StatusBadge>
                <span className="truncate text-muted-foreground">{[deviceBrandLabel(currentDevice.brand), currentDevice.hikModel?.trim()].filter(Boolean).join(" · ")}</span>
              </div>
            )}
            <SheetDescription>
              {deviceId && !isAdmin
                ? "Bağlantı, kapılar ve cihaz bilgileri"
                : !deviceId && step === "picker"
                  ? "Önce cihazın markasını seçin."
                  : "Zorunlu alanlar * ile işaretlidir."}
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
                  if (value === "overview") setOperationsVisited(true);
                }}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <TabsList className="mx-5 my-3 grid h-9 max-sm:h-auto max-sm:min-h-11 shrink-0 grid-cols-2 max-sm:[&_button]:min-h-11">
                  <TabsTrigger value="settings">Bilgiler</TabsTrigger>
                  <TabsTrigger value="overview">İşlemler</TabsTrigger>
                </TabsList>
                {operationsVisited && <TabsContent
                  value="overview"
                  forceMount
                  className="min-h-0 flex-1 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
                >
                  <QuerySectionBoundary resetKey={selectedDevice._id}>
                    <DeviceCommandCenter
                      deviceId={selectedDevice._id}
                      onPendingChange={setCommandPending}
                    />
                  </QuerySectionBoundary>
                  {isAdmin && <section aria-label="Yönetim" className="mt-4 space-y-4">
                    <h3 className="text-sm font-medium">Yönetim</h3>
                    <DeviceApiTokenCard
                      key={selectedDevice._id} deviceId={selectedDevice._id}
                      deviceName={selectedDevice.name} currentToken={selectedDevice.apiToken}
                      currentTokenCreatedAt={selectedDevice.apiTokenCreatedAt}
                      onPendingChange={setTokenPending}
                    />
                    {selectedDevice.brand === "hikvision" && selectedDevice.hikDevIndex && <DeviceGatewayDanger device={selectedDevice} onPendingChange={setGatewayPending} />}
                  </section>}
                </TabsContent>}
                {settingsVisited && (
                  <TabsContent
                    value="settings"
                    forceMount
                    className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
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
                        embedded
                        projectIdOverride={draftProjectId}
                        open={open}
                        device={selectedDevice}
                        disabled={!isAdmin}
                        projects={projects}
                        defaultBrand={selectedDevice.brand ?? "other"}
                        onSuccess={() => {
                          setFormStates({});
                        }}
                        onClose={close}
                        onStateChange={updateFormState}
                      />
                    )}

                  </TabsContent>
                )}
              </Tabs>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
                      data-device-brand={draftBrand}
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
