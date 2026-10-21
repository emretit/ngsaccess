import { formatTrDateTime } from "@/lib/date";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAction, useQuery } from "convex/react";
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
} from "lucide-react";
import { deviceConnection, commandResultMessage, capabilityLabel } from "@/lib/deviceStatus";
import { errorMessage, notify } from "@/lib/notify";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ServerDevice } from "@/types/device";

type OperationResult = {
  ok: boolean;
  error?: string;
  queued?: boolean;
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
  onPendingChange?: (pending: boolean) => void;
  device: ServerDevice;
  onUpdated?: () => void;
}

function formatDateTime(value: string | number | undefined): string {
  if (value === undefined) return "Henüz sinyal alınmadı";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz sinyal alınmadı";
  return formatTrDateTime(date);
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

function getAdapter(device: ServerDevice, hasIdeDoor: boolean): BrandAdapter {
  const brand = device.brand ?? "other";
  if (brand === "hikvision") {
    const isGateway = device.hikTransport !== "localBridge";
    const hasGatewayDevice = Boolean(device.hikDevIndex);
    const canGatewayCommand = isGateway && hasGatewayDevice;
    return {
      label: "Hikvision",
      transport: device.hikTransport === "localBridge" ? "Yerel köprü" : "Gateway",
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
        canGatewayCommand ? "" : "Gateway işlemleri için cihazın gateway kaydı gerekir.",
        device.hikTransport === "localBridge"
          ? "Yerel köprü bağlantısında okuyucu ayarları ve özellik taraması desteklenmiyor."
          : "",
      ].filter((item) => item.length > 0),
    };
  }

  if (brand === "ide_smart") {
    return {
      label: "IDE Smart",
      transport: "MQTT köprüsü",
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

export function DeviceCommandCenter({ device, onUpdated, onPendingChange }: DeviceCommandCenterProps) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  const overview = useQuery(api.deviceCenter.getOverview, { deviceId: device._id });
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

  const { run: execute, pending } = useAsyncAction(async (
    id: string, _label: string, run: () => Promise<OperationResult>,
    onSuccess?: (result: OperationResult) => void,
  ) => {
    setBusy(id);
    try {
      const result = await run();
      if (!result.ok) throw new Error(result.error ?? "İşlem başarısız");
      notify.success(result.queued ? "Komut sıraya alındı; cihaz onayı bekleniyor." : commandResultMessage(result));
      onSuccess?.(result);
      onUpdated?.();
    } finally { setBusy(null); }
  });
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const runImmediate = (id: string, label: string, run: () => Promise<OperationResult>, onSuccess?: (result: OperationResult) => void) => execute(id, label, run, onSuccess);
  const runConfirmed = async () => {
    if (!pendingAction) return;
    if (await execute(pendingAction.id, pendingAction.label, pendingAction.run)) setPendingAction(null);
  };

  if (overview === undefined) {
    return <SectionSkeleton rows={5} label="Cihaz bilgileri yükleniyor" />;
  }

  if (overview === null) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Cihaz merkezi bilgisi alınamadı.
      </div>
    );
  }

  const connection = deviceConnection(overview.device, clock);
  const connected = connection === "online";
  const offlineMessage = device.brand === "ide_smart" || (device.brand === "hikvision" && device.hikTransport === "localBridge")
    ? "Cihaz çevrimdışı — komut kuyruğa alınır"
    : "Cihaz çevrimdışı — komut ulaşmayabilir";
  const hasIdeDoor = overview.doors.some((door) => typeof door.ioId === "number");
  const adapter = getAdapter(overview.device, hasIdeDoor);
  const queueRows: { label: string; value: number; capped: boolean }[] =
    device.brand === "ide_smart"
      ? [
          { label: "Bekleyen", value: overview.queues.ideSmart.pending.count, capped: overview.queues.ideSmart.pending.capped },
          { label: "Gönderildi", value: overview.queues.ideSmart.sent.count, capped: overview.queues.ideSmart.sent.capped },
          { label: "Hatalı", value: overview.queues.ideSmart.failed.count, capped: overview.queues.ideSmart.failed.capped },
        ]
      : [
          { label: "Bekleyen", value: overview.queues.hikvision.pending.count, capped: overview.queues.hikvision.pending.capped },
          { label: "İşleniyor", value: overview.queues.hikvision.processing.count, capped: overview.queues.hikvision.processing.capped },
          { label: "Hatalı", value: overview.queues.hikvision.failed.count, capped: overview.queues.hikvision.failed.capped },
        ];

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
    runImmediate("readerCfg", "Okuyucu ayarlarını oku", async () => {
      const result = await fetchReaderCfg({ readerId });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Okuyucu ayarları alınamadı" };
    });

  const handleOpenDoor = (doorId: Id<"doors">, doorNo: number | undefined, doorName: string) => {
    if (device.brand !== "ide_smart" && (doorNo === undefined || !Number.isInteger(doorNo) || doorNo < 1)) {
      notify.error("Kapı numarası tanımlı veya geçerli değil. Kapı eşlemesini düzeltip tekrar deneyin.");
      return;
    }
    makeConfirmed({
      id: `openDoor:${doorId}`,
      title: "Kapı açılsın mı?",
      description: `${device.name ?? "Bu cihaz"} — ${doorName}${doorNo !== undefined ? ` (Kapı ${doorNo})` : ""} için kapı açma komutu gönderilecek.`,
      label: `Kapı aç (${doorName})`,
      run: async () => {
        if (device.brand === "ide_smart") {
          const result = await openIdeDoor({ deviceId: device._id, doorId, keep: 1 });
          return result.ok
            ? { ok: true, queued: true }
            : { ok: false, error: result.error ?? "Kapı açma kuyruğa alınamadı" };
        }
        if (doorNo === undefined || !Number.isInteger(doorNo) || doorNo < 1) {
          return { ok: false, error: "Kapı numarası geçerli değil. Kapı eşlemesini düzeltin." };
        }
        const result = await openHikDoor({ deviceId: device._id, doorNo });
        return result.ok ? { ok: true, queued: device.hikTransport === "localBridge" } : { ok: false, error: result.error ?? "Kapı açılamadı" };
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
          ? { ok: true, queued: true }
          : { ok: false, error: result.error ?? "Senkron komutu kuyruğa alınamadı" };
      },
    });
  };

  return (
    <div className="min-w-0 divide-y divide-line [&_button]:min-h-11 md:[&_button]:min-h-0">
      {connection === "offline" && <p role="status" className="py-3 text-sm text-warning">{offlineMessage}</p>}
      <section className="min-w-0 py-5 first:pt-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Bağlantı</h3>
              <Badge variant="outline">{adapter.label}</Badge>
              <Badge variant="secondary">{adapter.transport}</Badge>
            </div>
            <p className="break-all text-sm text-muted-foreground">
              {overview.device.deviceIp ?? overview.device.deviceSerial ?? overview.device.ideUuid ?? "Temel cihaz kaydı"}
            </p>
          </div>
          <StatusBadge tone={connected ? "success" : connection === "offline" ? "warning" : "neutral"}>
            {connected ? "Çevrimiçi" : connection === "never" ? "Henüz bağlanmadı" : "Çevrimdışı"}
          </StatusBadge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Metric label="Son sinyal" value={formatDateTime(overview.device.brand === "hikvision" && overview.device.hikTransport !== "localBridge" ? overview.device.hikLastSeenAt ?? overview.device.lastSeen : overview.device.lastSeen)} />
          <Metric label="Kapı / okuyucu" value={`${overview.doors.length} / ${overview.readers.length}`} />
          <Metric label="Model" value={overview.device.hikModel ?? "Belirtilmedi"} />
          <div className="flex min-w-0 items-start gap-2"><div className="min-w-0 flex-1"><Metric label="Kimlik" value={overview.device.ideUuid ?? overview.device.deviceSerial ?? "Belirtilmedi"} /></div><Button variant="ghost" size="sm" aria-label="Cihaz kimliğini kopyala" disabled={!(overview.device.ideUuid || overview.device.deviceSerial)} onClick={async () => {
            const identity = overview.device.ideUuid || overview.device.deviceSerial;
            if (!identity) return;
            try { await navigator.clipboard.writeText(identity); notify.success("Cihaz kimliği kopyalandı"); }
            catch (error: unknown) { notify.error("Cihaz kimliği kopyalanamadı", error); }
          }}>Kopyala</Button></div>
        </div>
      </section>

      <section className="min-w-0 py-5 first:pt-0">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">İşlemler</h4>
        </div>
        <div>
          <div className="min-w-0 border-b border-line py-3">
            <p className="mb-2 text-xs text-muted-foreground">Yalnız yüklenen kuyruk kayıtları. Tamamlanan işlemler fiziksel kapı açılışını doğrulamaz.</p>
            <p role="status" className="mb-2 text-sm">{queueRows.filter(row => row.label === "Bekleyen" || row.label === "Gönderildi" || row.label === "İşleniyor").reduce((total, row) => total + row.value, 0)}{queueRows.some(row => row.label !== "Hatalı" && row.capped) ? "+" : ""} işlem bekliyor · {queueRows.find(row => row.label === "Hatalı")?.value ?? 0}{queueRows.find(row => row.label === "Hatalı")?.capped ? "+" : ""} işlem başarısız</p>
            <div className="grid grid-cols-2 gap-2">
              {queueRows.map((row) => (
                <Metric key={row.label} label={row.label} value={row.capped ? "100+" : String(row.value)} compact />
              ))}
            </div>
          </div>

        </div>
      </section>

      <section className="min-w-0 py-5 first:pt-0">
        <div className="mb-3 flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Kapılar ve okuyucular</h4>
        </div>
        <div className="space-y-3">
          {overview.doors.map((door) => {
            const doorReaders = overview.readers.filter((reader) => reader.doorId === door._id);
            return (
              <div key={door._id} className="min-w-0 border-b border-line py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{door.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {device.brand === "ide_smart"
                        ? `ioId ${door.ioId ?? "-"} · Sensör ${door.requireSensor ? "zorunlu" : "zorunlu değil"}`
                        : door.hikDoorNo != null ? `Hik kapı kanalı #${door.hikDoorNo}` : ""}
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
                    title={connection === "offline" ? offlineMessage : undefined}
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
                              {reader.hikReaderNo != null && ` · Hik okuyucu kanalı #${reader.hikReaderNo}`}{reader.hikCardReaderPlanTemplateNo != null && ` · Plan ${reader.hikCardReaderPlanTemplateNo}`}{reader.hikCardReaderAntiSneakEnabled != null && ` · APB ${reader.hikCardReaderAntiSneakEnabled ? "açık" : "kapalı"}`}
                            </span>
                          )}
                        </div>
                        {device.brand === "hikvision" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title={!adapter.supported.readerCfg ? "Bu bağlantı yöntemi okuyucu ayarını okumayı desteklemiyor." : busy !== null ? "Devam eden işlemin bitmesini bekleyin." : undefined}
                            disabled={!adapter.supported.readerCfg || busy !== null}
                            onClick={() => handleFetchReaderCfg(reader._id)}
                          >
                            {busy === "readerCfg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                            Okuyucu ayarını oku
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

      <details className="min-w-0 py-5"><summary className="cursor-pointer text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">Teknik ayrıntı</summary>
          <div className="min-w-0 border-b border-line py-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Cihaz özellikleri</div>
            {overview.capabilities ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{overview.capabilities.supported} destekli</Badge>
                  <Badge variant="outline">{overview.capabilities.unsupported} yok</Badge>
                  <Badge variant="warning">{overview.capabilities.failed} hata</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Son tarama: {formatDateTime(overview.capabilities.updatedAt)}
                  <details className="mt-2"><summary>Tüm özellikler ve sorgu sonuçları</summary><ul className="space-y-1">{overview.capabilities.probes.map((probe) => <li key={probe.key}>{probe.label}: {capabilityLabel(probe)}{!probe.ok && probe.error ? ` — ${errorMessage(probe.error)}` : ""}</li>)}</ul></details>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Henüz özellik taraması yapılmadı.</div>
            )}
          </div>
      <section className="min-w-0 py-5 first:pt-0">
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

      <section className="min-w-0 py-5 first:pt-0">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Cihaz işlemleri</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton busy={busy === "capabilities"} disabled={!adapter.supported.capabilities || busy !== null} icon={<ScanLine className="h-4 w-4" />} onClick={handleFetchCapabilities}>
            Özellikleri tara
          </ActionButton>
          <ActionButton busy={busy === "workStatus"} disabled={!adapter.supported.workStatus || busy !== null} icon={<Activity className="h-4 w-4" />} onClick={handleFetchWorkStatus}>
            Çalışma Durumu
          </ActionButton>
          <ActionButton busy={busy === "reconcile"} disabled={!adapter.supported.reconcile || busy !== null} icon={<ListChecks className="h-4 w-4" />} onClick={handleReconcile}>
            Eşitlik Kontrolü
          </ActionButton>
          <ActionButton busy={busy === "backfillEvents"} disabled={!adapter.supported.capabilities || busy !== null} icon={<RefreshCw className="h-4 w-4" />} onClick={handleBackfill}>
            Olayları Tara
          </ActionButton>
          <ActionButton busy={busy === "captureCard"} disabled={!adapter.supported.capabilities || busy !== null} icon={<ScanLine className="h-4 w-4" />} onClick={handleCaptureCard}>
            Kart Okut
          </ActionButton>
          <ActionButton busy={busy === "triggerIdeSync"} disabled={!adapter.supported.triggerSync || busy !== null} icon={<RefreshCw className="h-4 w-4" />} onClick={handleTriggerIdeSync}>
            Panel senkronu
          </ActionButton>
          <ActionButton busy={busy === "reboot"} disabled={!adapter.supported.reboot || busy !== null} icon={<RotateCw className="h-4 w-4" />} onClick={handleReboot}>
            Yeniden Başlat
          </ActionButton>
        </div>

        {(adapter.unsupportedReasons.length > 0 || capturedCard || reconcileSummary) && (
          <div className="mt-3 space-y-2 text-sm">
            {capturedCard && (
              <div className="min-w-0 py-2">
                Okunan kart: <span className="font-mono">{capturedCard}</span>
              </div>
            )}
            {reconcileSummary && (
              <div className="min-w-0 py-2">Son eşitlik: {reconcileSummary}</div>
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

      <section className="min-w-0 py-5 first:pt-0">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Gelişmiş politikalar</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            Anti-passback
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Tatil planı
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Plan uygula
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Destek kontrolü ve onaylı kaydetme akışı hazırlandıkça bu işlemler açılacak.
        </p>
      </section>

      </details>
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open && !pending) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title ?? "İşlem onayı"}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
            <Button disabled={pending} onClick={runConfirmed}>{pending ? "İşlem sürüyor…" : "Onayla"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="min-w-0 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={compact ? "text-sm font-semibold tabular-nums" : "break-all text-sm font-medium tabular-nums"}>{value}</div>
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
