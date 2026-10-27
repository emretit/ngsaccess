import { usePermissions } from "@/hooks/usePermissions";
import { deviceConnection } from "@/lib/deviceStatus";
import { useNow } from "@/hooks/useNow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { deviceBrandLabel } from "@/lib/deviceBrand";
import { deviceConnectionBadge } from "./hooks/deviceConnectionBadge";
import { DeviceGatewayDanger } from "./DeviceGatewayDanger";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../../convex/_generated/dataModel";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { DeviceForm } from "./DeviceForm";
import { BrandPickerStep } from "./BrandPickerStep";
import { DeviceApiTokenCard } from "./DeviceApiTokenCard";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGuardedFormNavigation } from "@/hooks/useGuardedFormNavigation";
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
  const { can } = usePermissions();
  const canManage = can("devices.manage");
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
  const [tab, setTab] = useState(canManage ? "settings" : "overview");
  const [step, setStep] = useState<"picker" | "form">("picker");
  const [settingsVisited, setSettingsVisited] = useState(canManage);
  const [operationsVisited, setOperationsVisited] = useState(!canManage);
  const needsProjects = open && (!selectedDevice || settingsVisited);
  const queriedProjects = useQuery(api.projects.list, needsProjects ? {} : "skip");
  const [projectCache, setProjectCache] = useState(queriedProjects);
  if (queriedProjects !== undefined && queriedProjects !== projectCache) setProjectCache(queriedProjects);
  // Kapanış animasyonunda ve yeniden açılışta son listeyi göster; iskelete dönme.
  const projects = queriedProjects ?? projectCache;
  const contentRef = useRef<HTMLDivElement>(null);
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
    setSettingsVisited(canManage);
    setOperationsVisited(!canManage);
    setTab(canManage ? "settings" : "overview");
  }, [resetKey, deviceId, initialBrand, canManage]);
  const pending =
    commandPending || tokenPending || gatewayPending || Object.values(formStates).some((state) => state?.pending);
  const dirty = Object.values(formStates).some((state) => state?.dirty);
  const guard = useGuardedFormNavigation({ active: open, dirty, pending });
  useEffect(() => {
    if (projectChanged) onClose();
  }, [projectChanged, onClose]);
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
      <DetailSheet
        open={open}
        onRequestClose={close}
        pending={pending}
        size="lg"
        focusTitleOnOpen={Boolean(deviceId)}
        contentProps={{ ref: contentRef, className: "max-sm:[&>button]:min-h-11 max-sm:[&>button]:min-w-11" }}
        headerClassName="border-b border-line pr-12 text-left"
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
        title={deviceId ? canManage ? "Cihaz düzenle" : "Cihaz ayrıntısı" : step === "picker" ? "Yeni cihaz" : `Yeni cihaz · ${BRAND_LABELS[brand]}`}
        headerExtra={currentDevice && (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate">{currentDevice.name}</span>
            <StatusBadge tone={deviceConnectionBadge(connectionStatus).tone}>{deviceConnectionBadge(connectionStatus).label}</StatusBadge>
            <span className="truncate text-muted-foreground">{[deviceBrandLabel(currentDevice.brand), currentDevice.hikModel?.trim()].filter(Boolean).join(" · ")}</span>
          </div>
        )}
        description={deviceId && !canManage
          ? "Bağlantı, kapılar ve cihaz bilgileri"
          : !deviceId && step === "picker"
            ? "Önce cihazın markasını seçin."
            : "Zorunlu alanlar * ile işaretlidir."}
      >
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
                className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1 data-[state=inactive]:hidden"
              >
                <QuerySectionBoundary resetKey={selectedDevice._id}>
                  <DeviceCommandCenter
                    deviceId={selectedDevice._id}
                    onPendingChange={setCommandPending}
                  />
                </QuerySectionBoundary>
                {canManage && <section aria-label="Yönetim" className="divide-y divide-line border-t border-line">
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
                  {!canManage && (
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
                      disabled={!canManage}
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
      </DetailSheet>
      {guard.dialog}
    </>
  );
}
