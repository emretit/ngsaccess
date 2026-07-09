import { useState } from "react";
import type { ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Activity,
  AlertCircle,
  DoorOpen,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCw,
  ScanLine,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ServerDevice } from "@/types/device";

type OperationResult = {
  ok: boolean;
  error?: string;
};

type ConfirmedAction = {
  id: string;
  title: string;
  description: string;
  label: string;
  run: () => Promise<OperationResult>;
};

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

type BrandAdapter = {
  label: string;
  transport: string;
  supported: {
    capabilities: boolean;
    workStatus: boolean;
    readerCfg: boolean;
    openDoor: boolean;
    reboot: boolean;
    reconcile: boolean;
    triggerSync: boolean;
  };
  unsupportedReasons: string[];
};

interface DeviceCommandCenterProps {
  device: ServerDevice;
  onUpdated?: () => void;
}

function formatDateTime(value: string | number | undefined): string {
  if (value === undefined) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("tr-TR");
}

function formatDirection(value: string | undefined): string {
  switch (value) {
    case "entry":
      return "Giriş";
    case "exit":
      return "Çıkış";
    case "both":
      return "Çift yön";
    default:
      return "-";
  }
}

function eventVariant(category: string, severity: string): BadgeVariant {
  if (severity === "critical") return "destructive";
  if (severity === "warning" || category === "alarm" || category === "exception") {
    return "warning";
  }
  if (category === "operation") return "info";
  if (category === "status" || category === "unknown") return "outline";
  return "secondary";
}

function eventCategoryLabel(category: string): string {
  switch (category) {
    case "access":
      return "Geçiş";
    case "alarm":
      return "Alarm";
    case "exception":
      return "İstisna";
    case "operation":
      return "Operasyon";
    case "status":
      return "Durum";
    default:
      return "Bilinmiyor";
  }
}

function stringifyUnknown(value: unknown): string | undefined {
  try {
    const result = JSON.stringify(value);
    return result === undefined ? undefined : result;
  } catch {
    return undefined;
  }
}

function resultMessage(result: OperationResult): string {
  return result.ok ? "İşlem tamamlandı" : result.error ?? "İşlem başarısız";
}

function getAdapter(device: ServerDevice, hasIdeDoor: boolean): BrandAdapter {
  const brand = device.brand ?? "other";
  if (brand === "hikvision") {
    const isGateway = device.hikTransport === "gateway";
    const hasGatewayDevice = Boolean(device.hikDevIndex);
    const canGatewayCommand = isGateway && hasGatewayDevice;
    return {
      label: "Hikvision",
      transport: device.hikTransport === "localBridge" ? "Yerel Bridge" : "Gateway",
      supported: {
        capabilities: canGatewayCommand,
        workStatus: canGatewayCommand,
        readerCfg: canGatewayCommand,
        openDoor: device.hikTransport === "localBridge" || canGatewayCommand,
        reboot: canGatewayCommand,
        reconcile: canGatewayCommand,
        triggerSync: false,
      },
      unsupportedReasons: [
        canGatewayCommand ? "" : "Gateway aksiyonları için cihazın gateway kaydı gerekir.",
        device.hikTransport === "localBridge"
          ? "Okuyucu cfg ve capability taraması localBridge transport'ta kapalıdır."
          : "",
      ].filter((item) => item.length > 0),
    };
  }

  if (brand === "ide_smart") {
    return {
      label: "IDE Smart",
      transport: "MQTT Bridge",
      supported: {
        capabilities: false,
        workStatus: false,
        readerCfg: false,
        openDoor: Boolean(device.ideUuid) && hasIdeDoor,
        reboot: false,
        reconcile: false,
        triggerSync: Boolean(device.ideUuid),
      },
      unsupportedReasons: [
        device.ideUuid ? "" : "IDE Smart komutları için Panel UUID gerekir.",
        hasIdeDoor ? "" : "Kapı açma için panele bağlı ioId tanımlı kapı gerekir.",
      ].filter((item) => item.length > 0),
    };
  }

  return {
    label: "Genel cihaz",
    transport: "Temel kayıt",
    supported: {
      capabilities: false,
      workStatus: false,
      readerCfg: false,
      openDoor: false,
      reboot: false,
      reconcile: false,
      triggerSync: false,
    },
    unsupportedReasons: ["Bu marka için gelişmiş cihaz komutları henüz tanımlı değil."],
  };
}

export function DeviceCommandCenter({ device, onUpdated }: DeviceCommandCenterProps) {
  const overview = useQuery(api.deviceCenter.getOverview, { deviceId: device._id });
  const recordOperation = useMutation(api.deviceEvents.recordSystemOperation);
  const fetchCapabilities = useAction(api.actions.hikGatewayDevice.fetchDeviceCapabilities);
  const fetchWorkStatus = useAction(api.actions.hikGatewayDevice.fetchDeviceWorkStatus);
  const reconcile = useAction(api.actions.hikGatewayDevice.reconcileDevice);
  const backfillEvents = useAction(api.actions.hikGatewayDevice.backfillDeviceEvents);
  const captureCard = useAction(api.actions.hikGatewayDevice.captureCardFromDevice);
  const fetchReaderCfg = useAction(api.actions.hikGatewayDevice.fetchReaderCfg);
  const openHikDoor = useAction(api.actions.hikGatewayDevice.remoteOpenDoor);
  const rebootHikDevice = useAction(api.actions.hikGatewayDevice.rebootDevice);
  const openIdeDoor = useAction(api.actions.ideGatewayDevice.openIdeDoor);
  const triggerIdeSync = useAction(api.actions.ideGatewayDevice.triggerPanelSync);

  const [busy, setBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmedAction | null>(null);
  const [reconcileSummary, setReconcileSummary] = useState<string | null>(null);
  const [capturedCard, setCapturedCard] = useState<string | null>(null);

  if (overview === undefined) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center rounded-md border bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cihaz merkezi yükleniyor...
        </div>
      </div>
    );
  }

  if (overview === null) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Cihaz merkezi bilgisi alınamadı.
      </div>
    );
  }

  const hasIdeDoor = overview.doors.some((door) => typeof door.ioId === "number");
  const adapter = getAdapter(device, hasIdeDoor);
  const queueRows: { label: string; value: number }[] =
    device.brand === "ide_smart"
      ? [
          { label: "Bekleyen", value: overview.queues.ideSmart.pending.count },
          { label: "Gönderildi", value: overview.queues.ideSmart.sent.count },
          { label: "Onaylandı", value: overview.queues.ideSmart.acked.count },
          { label: "Hatalı", value: overview.queues.ideSmart.failed.count },
        ]
      : [
          { label: "Bekleyen", value: overview.queues.hikvision.pending.count },
          { label: "İşleniyor", value: overview.queues.hikvision.processing.count },
          { label: "Tamamlandı", value: overview.queues.hikvision.done.count },
          { label: "Hatalı", value: overview.queues.hikvision.failed.count },
        ];

  const audit = async (label: string, result: OperationResult, raw?: unknown) => {
    try {
      await recordOperation({
        deviceId: device._id,
        label: `${label}: ${result.ok ? "başarılı" : "başarısız"}`,
        ok: result.ok,
        rawData: stringifyUnknown(raw ?? result),
      });
    } catch (error) {
      console.warn("Operation audit kaydı yazılamadı", error);
    }
  };

  const runImmediate = async (
    id: string,
    label: string,
    run: () => Promise<OperationResult>,
    onSuccess?: (result: OperationResult) => void,
  ) => {
    setBusy(id);
    try {
      const result = await run();
      await audit(label, result);
      if (result.ok) {
        toast.success(resultMessage(result));
        onSuccess?.(result);
        onUpdated?.();
      } else {
        toast.error(resultMessage(result));
      }
    } catch (error) {
      const result = { ok: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
      await audit(label, result);
      toast.error(result.error);
    } finally {
      setBusy(null);
    }
  };

  const runConfirmed = async () => {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    setBusy(action.id);
    try {
      const result = await action.run();
      await audit(action.label, result);
      if (result.ok) {
        toast.success(resultMessage(result));
        onUpdated?.();
      } else {
        toast.error(resultMessage(result));
      }
    } catch (error) {
      const result = { ok: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
      await audit(action.label, result);
      toast.error(result.error);
    } finally {
      setBusy(null);
    }
  };

  const makeConfirmed = (action: ConfirmedAction) => {
    setPendingAction(action);
  };

  const handleFetchCapabilities = () =>
    runImmediate("capabilities", "Özellikleri tara", async () => {
      const result = await fetchCapabilities({ deviceId: device._id });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Özellik taraması başarısız" };
    });

  const handleFetchWorkStatus = () =>
    runImmediate("workStatus", "Çalışma durumu al", async () => {
      const result = await fetchWorkStatus({ deviceId: device._id });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Çalışma durumu alınamadı" };
    });

  const handleReconcile = () =>
    runImmediate(
      "reconcile",
      "Eşitlik kontrolü",
      async () => {
        const result = await reconcile({ deviceId: device._id });
        if (!result.ok) {
          return { ok: false, error: result.error ?? "Eşitlik kontrolü başarısız" };
        }
        setReconcileSummary(
          `Kart ${result.onDeviceCount}/${result.expectedCount}, yüz ${result.faceOnDeviceCount}/${result.faceExpectedCount}, parmak izi ${result.fingerprintOnDeviceCount}/${result.fingerprintExpectedCount}`,
        );
        return { ok: true };
      },
    );

  const handleBackfill = () =>
    runImmediate("backfillEvents", "Geçmiş olayları tara", async () => {
      const result = await backfillEvents({ deviceId: device._id });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Geçmiş olaylar alınamadı" };
    });

  const handleCaptureCard = () =>
    runImmediate(
      "captureCard",
      "Canlı kart okut",
      async () => {
        const result = await captureCard({ deviceId: device._id });
        if (!result.ok) {
          return { ok: false, error: result.error ?? "Kart okunamadı" };
        }
        setCapturedCard(result.cardNo ?? null);
        return { ok: true };
      },
    );

  const handleFetchReaderCfg = (readerId: Id<"readers">) =>
    runImmediate("readerCfg", "Okuyucu cfg oku", async () => {
      const result = await fetchReaderCfg({ readerId });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Okuyucu cfg alınamadı" };
    });

  const handleOpenDoor = (doorId: Id<"doors">, doorNo: number | undefined, doorName: string) => {
    makeConfirmed({
      id: `openDoor:${doorId}`,
      title: "Kapı açılsın mı?",
      description: `${doorName} için panele kapı açma komutu gönderilecek.`,
      label: `Kapı aç (${doorName})`,
      run: async () => {
        if (device.brand === "ide_smart") {
          const result = await openIdeDoor({ deviceId: device._id, doorId, keep: 1 });
          return result.ok
            ? { ok: true }
            : { ok: false, error: result.error ?? "Kapı açma kuyruğa alınamadı" };
        }
        const result = await openHikDoor({ deviceId: device._id, doorNo: doorNo ?? 1 });
        return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Kapı açılamadı" };
      },
    });
  };

  const handleReboot = () => {
    makeConfirmed({
      id: "reboot",
      title: "Cihaz yeniden başlatılsın mı?",
      description: "Cihaz kısa süre offline olabilir. Bu işlem fiziksel paneli etkiler.",
      label: "Cihazı yeniden başlat",
      run: async () => {
        const result = await rebootHikDevice({ deviceId: device._id });
        return result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "Yeniden başlatma başarısız" };
      },
    });
  };

  const handleTriggerIdeSync = () => {
    makeConfirmed({
      id: "triggerIdeSync",
      title: "Panel senkronu tetiklensin mi?",
      description: "IDE Smart paneline MQTT üzerinden sync komutu gönderilecek.",
      label: "IDE Smart panel sync",
      run: async () => {
        const result = await triggerIdeSync({ deviceId: device._id });
        return result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "Sync kuyruğa alınamadı" };
      },
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-md border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Cihaz Merkezi</h3>
              <Badge variant="outline">{adapter.label}</Badge>
              <Badge variant="secondary">{adapter.transport}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {overview.device.deviceIp ?? overview.device.deviceSerial ?? overview.device.ideUuid ?? "Temel cihaz kaydı"}
            </p>
          </div>
          <Badge variant={overview.online.isOnline ? "success" : "outline"} className="gap-1">
            {overview.online.isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {overview.online.isOnline ? "Online" : "Offline / belirsiz"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Kapı" value={String(overview.doors.length)} />
          <Metric label="Okuyucu" value={String(overview.readers.length)} />
          <Metric label="Son sinyal" value={formatDateTime(overview.device.lastSeen ?? overview.device.hikLastSeenAt)} />
          <Metric label="Model" value={overview.device.hikModel ?? overview.device.ideUuid ?? "-"} />
        </div>
      </section>

      <section className="rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Tanılama</h4>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Kuyruk</div>
            <div className="grid grid-cols-2 gap-2">
              {queueRows.map((row) => (
                <Metric key={row.label} label={row.label} value={String(row.value)} compact />
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Capability Snapshot</div>
            {overview.capabilities ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{overview.capabilities.supported} destekli</Badge>
                  <Badge variant="outline">{overview.capabilities.unsupported} yok</Badge>
                  <Badge variant="warning">{overview.capabilities.failed} hata</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Son tarama: {formatDateTime(overview.capabilities.updatedAt)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Snapshot yok.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Son Cihaz Olayları</h4>
        </div>
        {overview.recentEvents.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Kayıt yok.</div>
        ) : (
          <div className="space-y-2">
            {overview.recentEvents.map((event) => (
              <div key={event._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{event.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(event.eventTime)}
                    {event.cardNo ? ` · Kart ${event.cardNo}` : ""}
                  </div>
                </div>
                <Badge variant={eventVariant(event.category, event.severity)}>
                  {eventCategoryLabel(event.category)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Kapılar & Okuyucular</h4>
        </div>
        <div className="space-y-3">
          {overview.doors.map((door) => {
            const doorReaders = overview.readers.filter((reader) => reader.doorId === door._id);
            return (
              <div key={door._id} className="rounded-md border bg-muted/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{door.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {device.brand === "ide_smart"
                        ? `ioId ${door.ioId ?? "-"} · Sensör ${door.requireSensor ? "zorunlu" : "zorunlu değil"}`
                        : `Hik kapı #${door.hikDoorNo ?? "-"}`}
                    </div>
                    {door.latestReading && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Son okuma: {door.latestReading.cardNo} · {formatDateTime(door.latestReading.accessTime)}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!adapter.supported.openDoor || busy !== null}
                    onClick={() => handleOpenDoor(door._id, door.hikDoorNo, door.name)}
                  >
                    {busy === `openDoor:${door._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                    Aç
                  </Button>
                </div>

                {doorReaders.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {doorReaders.map((reader) => (
                      <div key={reader._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background p-2 text-sm">
                        <div>
                          <span className="font-medium">{reader.name}</span>
                          <span className="text-muted-foreground"> · {formatDirection(reader.direction)}</span>
                          {device.brand === "hikvision" && (
                            <span className="text-muted-foreground">
                              {" "}· Hik #{reader.hikReaderNo ?? "-"} · Plan {reader.hikCardReaderPlanTemplateNo ?? "-"} · APB {reader.hikCardReaderAntiSneakEnabled ? "açık" : "kapalı"}
                            </span>
                          )}
                        </div>
                        {device.brand === "hikvision" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!adapter.supported.readerCfg || busy !== null}
                            onClick={() => handleFetchReaderCfg(reader._id)}
                          >
                            {busy === "readerCfg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                            Oku
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {overview.doors.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Bu cihaza bağlı kapı yok.</div>
          )}
        </div>
      </section>

      <section className="rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Aksiyonlar</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton busy={busy === "capabilities"} disabled={!adapter.supported.capabilities || busy !== null} icon={<ScanLine className="h-4 w-4" />} onClick={handleFetchCapabilities}>
            Özellikleri Tara
          </ActionButton>
          <ActionButton busy={busy === "workStatus"} disabled={!adapter.supported.workStatus || busy !== null} icon={<Activity className="h-4 w-4" />} onClick={handleFetchWorkStatus}>
            Çalışma Durumu
          </ActionButton>
          <ActionButton busy={busy === "reconcile"} disabled={!adapter.supported.reconcile || busy !== null} icon={<ListChecks className="h-4 w-4" />} onClick={handleReconcile}>
            Eşitlik Kontrolü
          </ActionButton>
          <ActionButton busy={busy === "backfillEvents"} disabled={device.brand !== "hikvision" || busy !== null} icon={<RefreshCw className="h-4 w-4" />} onClick={handleBackfill}>
            Olayları Tara
          </ActionButton>
          <ActionButton busy={busy === "captureCard"} disabled={device.brand !== "hikvision" || busy !== null} icon={<ScanLine className="h-4 w-4" />} onClick={handleCaptureCard}>
            Kart Okut
          </ActionButton>
          <ActionButton busy={busy === "triggerIdeSync"} disabled={!adapter.supported.triggerSync || busy !== null} icon={<RefreshCw className="h-4 w-4" />} onClick={handleTriggerIdeSync}>
            IDE Sync
          </ActionButton>
          <ActionButton busy={busy === "reboot"} disabled={!adapter.supported.reboot || busy !== null} icon={<RotateCw className="h-4 w-4" />} onClick={handleReboot}>
            Yeniden Başlat
          </ActionButton>
        </div>

        {(adapter.unsupportedReasons.length > 0 || capturedCard || reconcileSummary) && (
          <div className="mt-3 space-y-2 text-sm">
            {capturedCard && (
              <div className="rounded-md border bg-muted/20 p-2">
                Okunan kart: <span className="font-mono">{capturedCard}</span>
              </div>
            )}
            {reconcileSummary && (
              <div className="rounded-md border bg-muted/20 p-2">Son eşitlik: {reconcileSummary}</div>
            )}
            {adapter.unsupportedReasons.map((reason) => (
              <div key={reason} className="flex items-start gap-2 rounded-md border border-dashed p-2 text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Gelişmiş Politikalar</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            Anti-passback
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Holiday Plan
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Plan Uygula
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Capability destek kontrolü ve onaylı write akışı hazırlandıkça bu işlemler açılacak.
        </p>
      </section>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title ?? "İşlem onayı"}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={compact ? "text-sm font-semibold" : "truncate text-sm font-semibold"}>{value}</div>
    </div>
  );
}

function ActionButton({
  busy,
  disabled,
  icon,
  children,
  onClick,
}: {
  busy: boolean;
  disabled: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </Button>
  );
}
