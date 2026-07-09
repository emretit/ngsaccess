import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
  RefreshCw,
  Trash2,
  RotateCw,
  Activity,
  ListChecks,
  History,
  CreditCard,
  Settings2,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";
import { DeviceHikLocalBridgeSection } from "./DeviceHikLocalBridgeSection";

/** Gateway heartbeat eşiği — bu süre içinde sinyal gelmemişse offline say. */
const HIK_ONLINE_WINDOW_MS = 5 * 60 * 1000;

type CapabilityProbeResult = {
  key: string;
  label: string;
  endpoint: string;
  ok: boolean;
  supported: boolean | null;
  matchedField?: string;
  error?: string;
};

type CapabilitySnapshot = {
  version: 1;
  updatedAt: number;
  probes: CapabilityProbeResult[];
};

type DeviceEventCategory =
  | "access"
  | "alarm"
  | "exception"
  | "operation"
  | "status"
  | "unknown";
type DeviceEventSeverity = "info" | "warning" | "critical";
type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

interface DeviceHikvisionSectionProps {
  form: UseFormReturn<FormValues>;
  /** Edit mode'da set edilir; status badge + lifecycle aksiyonları görünür. */
  device?: ServerDevice | null;
  onUpdated?: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCapabilitySnapshot(raw: string | undefined): CapabilitySnapshot | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== 1 || typeof parsed.updatedAt !== "number") return null;
    if (!Array.isArray(parsed.probes)) return null;
    const probes: CapabilityProbeResult[] = [];
    for (const item of parsed.probes) {
      if (!isRecord(item)) continue;
      if (
        typeof item.key !== "string" ||
        typeof item.label !== "string" ||
        typeof item.endpoint !== "string" ||
        typeof item.ok !== "boolean"
      ) {
        continue;
      }
      const supported =
        typeof item.supported === "boolean" || item.supported === null
          ? item.supported
          : null;
      probes.push({
        key: item.key,
        label: item.label,
        endpoint: item.endpoint,
        ok: item.ok,
        supported,
        matchedField: typeof item.matchedField === "string" ? item.matchedField : undefined,
        error: typeof item.error === "string" ? item.error : undefined,
      });
    }
    return { version: 1, updatedAt: parsed.updatedAt, probes };
  } catch {
    return null;
  }
}

function deviceEventCategoryLabel(category: DeviceEventCategory): string {
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
    case "unknown":
      return "Bilinmiyor";
  }
}

function deviceEventBadgeVariant(
  category: DeviceEventCategory,
  severity: DeviceEventSeverity,
): BadgeVariant {
  if (severity === "critical") return "destructive";
  if (category === "alarm" || category === "exception" || severity === "warning") {
    return "warning";
  }
  if (category === "operation") return "info";
  if (category === "status" || category === "unknown") return "outline";
  return "secondary";
}

function formatEventTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("tr-TR");
}

export function DeviceHikvisionSection({
  form,
  device,
  onUpdated,
}: DeviceHikvisionSectionProps) {
  const remove = useAction(api.actions.hikGatewayDevice.removeDeviceFromGateway);
  const refresh = useAction(api.actions.hikGatewayDevice.refreshGatewayDeviceStatus);
  const openDoor = useAction(api.actions.hikGatewayDevice.remoteOpenDoor);
  const reboot = useAction(api.actions.hikGatewayDevice.rebootDevice);
  const fetchWorkStatus = useAction(api.actions.hikGatewayDevice.fetchDeviceWorkStatus);
  const reconcile = useAction(api.actions.hikGatewayDevice.reconcileDevice);
  const backfill = useAction(api.actions.hikGatewayDevice.backfillDeviceEvents);
  const captureCard = useAction(api.actions.hikGatewayDevice.captureCardFromDevice);
  const fetchCapabilities = useAction(api.actions.hikGatewayDevice.fetchDeviceCapabilities);

  const [busy, setBusy] = useState<string | null>(null);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState<CapabilitySnapshot | null>(() =>
    parseCapabilitySnapshot(device?.hikCapabilitiesSnapshot)
  );

  // Gelişmiş aksiyon sonuç state'leri
  const [workStatus, setWorkStatus] = useState<{
    updatedAt: number;
    doorStatus?: number[];
    magneticStatus?: number[];
    cardReaderOnlineStatus?: number[];
    batteryVoltage?: number;
    powerSupplyStatus?: string;
  } | null>(null);
  const [reconcileResult, setReconcileResult] = useState<{
    // Kart
    expectedCount: number;
    onDeviceCount: number;
    onDeviceNotExpected: string[];
    expectedNotOnDevice: string[];
    // Yüz
    faceExpectedCount: number;
    faceOnDeviceCount: number;
    faceOnDeviceNotExpected: string[];
    faceExpectedNotOnDevice: string[];
    // Parmak izi
    fingerprintExpectedCount: number;
    fingerprintOnDeviceCount: number;
    fingerprintOnDeviceNotExpected: string[];
    fingerprintExpectedNotOnDevice: string[];
  } | null>(null);
  const [capturedCard, setCapturedCard] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Seçilmemişse (düzenlemede kayıtlı transport yoksa) hiçbir alt bölümü gösterme;
  // kullanıcı İletişim Yöntemi'nden açıkça seçsin. Zorla gateway varsaymak yanıltıcıydı.
  const transport = form.watch("hik_transport");
  const isLocalBridge = transport === "localBridge";
  const isGateway = transport === "gateway";
  const recentDeviceEvents = useQuery(
    api.deviceEvents.listForDevice,
    device?._id && isGateway ? { deviceId: device._id, limit: 8 } : "skip",
  );

  useEffect(() => {
    setCapabilitySnapshot(parseCapabilitySnapshot(device?.hikCapabilitiesSnapshot));
  }, [device?.hikCapabilitiesSnapshot]);

  useEffect(() => {
    // Heartbeat tazeliği yalnız gateway online/offline rozeti için gerekli; localBridge'de
    // 30 sn'lik gereksiz re-render'ı atla.
    if (isLocalBridge) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [isLocalBridge]);

  const isOnline =
    device?.hikLastSeenAt !== undefined &&
    now - device.hikLastSeenAt < HIK_ONLINE_WINDOW_MS &&
    !device.hikOfflineHint;

  const handleOpenDoor = async () => {
    if (!device) return;
    setBusy("door");
    try {
      const result = await openDoor({ deviceId: device._id, doorNo: 1 });
      if (result.ok) toast.success("Kapı açma komutu gönderildi.");
      else toast.error(`Kapı açma başarısız: ${result.error ?? "?"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      const result = await refresh();
      toast.success(`Tarandı: ${result.scanned} cihaz (${result.offline} offline)`);
      onUpdated?.();
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!device) return;
    setBusy("remove");
    try {
      const result = await remove({ deviceId: device._id });
      if (result.ok) {
        toast.success("Gateway'den silindi.");
        onUpdated?.();
      } else {
        toast.error(`Silme başarısız: ${result.error ?? "?"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReboot = async () => {
    if (!device) return;
    const confirmed = window.confirm("Cihaz yeniden başlatılsın mı? ~30-60sn offline olur.");
    if (!confirmed) return;
    setBusy("reboot");
    try {
      const result = await reboot({ deviceId: device._id });
      if (result.ok) toast.success("Yeniden başlatma komutu gönderildi.");
      else toast.error(`Yeniden başlatma başarısız: ${result.error ?? "?"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleFetchWorkStatus = async () => {
    if (!device) return;
    setBusy("workStatus");
    try {
      const result = await fetchWorkStatus({ deviceId: device._id });
      if (result.ok && result.status) {
        setWorkStatus(result.status);
        toast.success("Çalışma durumu alındı.");
      } else {
        toast.error(`Durum alınamadı: ${result.error ?? "?"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReconcile = async () => {
    if (!device) return;
    setBusy("reconcile");
    try {
      const result = await reconcile({ deviceId: device._id });
      if (result.ok) {
        setReconcileResult({
          expectedCount: result.expectedCount,
          onDeviceCount: result.onDeviceCount,
          onDeviceNotExpected: result.onDeviceNotExpected,
          expectedNotOnDevice: result.expectedNotOnDevice,
          faceExpectedCount: result.faceExpectedCount,
          faceOnDeviceCount: result.faceOnDeviceCount,
          faceOnDeviceNotExpected: result.faceOnDeviceNotExpected,
          faceExpectedNotOnDevice: result.faceExpectedNotOnDevice,
          fingerprintExpectedCount: result.fingerprintExpectedCount,
          fingerprintOnDeviceCount: result.fingerprintOnDeviceCount,
          fingerprintOnDeviceNotExpected: result.fingerprintOnDeviceNotExpected,
          fingerprintExpectedNotOnDevice: result.fingerprintExpectedNotOnDevice,
        });
        toast.success("Eşitlik kontrolü tamamlandı.");
      } else {
        toast.error(`Eşitlik kontrolü başarısız: ${result.error ?? "?"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleBackfill = async () => {
    if (!device) return;
    setBusy("backfill");
    try {
      const result = await backfill({ deviceId: device._id });
      if (result.ok) {
        toast.success(`Tarandı: ${result.scanned}, eklendi: ${result.inserted}, atlandı: ${result.skipped}`);
      } else {
        toast.error(`Geçmiş çekme başarısız: ${result.error ?? "?"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCaptureCard = async () => {
    if (!device) return;
    setCapturedCard(null);
    setBusy("captureCard");
    try {
      const result = await captureCard({ deviceId: device._id });
      if (result.ok && result.cardNo) {
        setCapturedCard(result.cardNo);
        toast.success(`Okunan kart: ${result.cardNo}`);
      } else if (result.ok) {
        toast("Kart okunamadı");
      } else {
        toast.error(`Kart okuma başarısız: ${result.error ?? "?"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleFetchCapabilities = async () => {
    if (!device) return;
    setBusy("capabilities");
    try {
      const result = await fetchCapabilities({ deviceId: device._id });
      if (result.ok && result.snapshot) {
        setCapabilitySnapshot(result.snapshot);
        const supported = result.snapshot.probes.filter((p) => p.supported === true).length;
        const failed = result.snapshot.probes.filter((p) => !p.ok).length;
        toast.success(`Özellikler tarandı: ${supported} destekli, ${failed} hata`);
        onUpdated?.();
      } else {
        toast.error(`Özellik taraması başarısız: ${result.error ?? "?"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const renderStatusBadge = () => {
    if (!device) return null;
    if (isLocalBridge) return <Badge variant="outline">Yerel Bridge</Badge>;
    if (!device.hikDevIndex) return <Badge variant="outline">Kayıtsız</Badge>;
    if (isOnline) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Online
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" /> Offline
      </Badge>
    );
  };

  const capabilityCounts = capabilitySnapshot
    ? {
        supported: capabilitySnapshot.probes.filter((p) => p.supported === true).length,
        unsupported: capabilitySnapshot.probes.filter((p) => p.supported === false).length,
        unknown: capabilitySnapshot.probes.filter((p) => p.ok && p.supported === null).length,
        failed: capabilitySnapshot.probes.filter((p) => !p.ok).length,
      }
    : null;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isLocalBridge ? "Yerel Bridge" : isGateway ? "Gateway" : "Hikvision"} Bağlantısı
        </h3>
        {renderStatusBadge()}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="hik_transport"
          render={({ field }) => (
            <FormItem>
              <FormLabel>İletişim Yöntemi</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="gateway">Gateway (ISUP → Hetzner)</SelectItem>
                  <SelectItem value="localBridge">Yerel Bridge (LAN Windows EXE)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="device_ip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isLocalBridge ? "Panel IP (LAN)" : "Cihaz IP (LAN, opsiyonel)"}</FormLabel>
              <FormControl>
                <Input placeholder="192.168.1.117" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {isLocalBridge ? (
        <DeviceHikLocalBridgeSection
          form={form}
          device={device}
          onOpenDoor={handleOpenDoor}
          openingDoor={busy === "door"}
        />
      ) : isGateway ? (
        <>
          {device?.hikDevIndex && (
            <div>
              <Label className="text-xs">devIndex (gateway UUID)</Label>
              <Input
                value={device.hikDevIndex}
                disabled
                className="bg-muted font-mono text-xs"
              />
            </div>
          )}

          {device?.hikOfflineHint && (
            <p className="text-xs text-destructive">{device.hikOfflineHint}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="ehome_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ehome ID <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. FingerNGS" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ehome_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şifreleme Anahtarı <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="16 karakter, cihazdaki ile aynı" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {device?.hikDevIndex && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenDoor}
                disabled={busy !== null}
              >
                {busy === "door" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <DoorOpen className="w-4 h-4 mr-2" />
                )}
                Kapıyı Aç
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={busy !== null}
              >
                {busy === "refresh" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Durumu Yenile
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={busy !== null}
              >
                {busy === "remove" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Kaldır
              </Button>
            </div>
          )}

          {/* ── Gelişmiş Aksiyonlar ── */}
          {device?.hikDevIndex && (
            <div className="space-y-3 pt-3 border-t">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gelişmiş
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {/* Yeniden Başlat */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReboot}
                  disabled={busy !== null}
                >
                  {busy === "reboot" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCw className="w-4 h-4 mr-2" />
                  )}
                  Yeniden Başlat
                </Button>

                {/* Çalışma Durumu */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchWorkStatus}
                  disabled={busy !== null}
                >
                  {busy === "workStatus" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  Çalışma Durumu
                </Button>

                {/* Eşitlik Kontrolü */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReconcile}
                  disabled={busy !== null}
                >
                  {busy === "reconcile" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ListChecks className="w-4 h-4 mr-2" />
                  )}
                  Eşitlik Kontrolü
                </Button>

                {/* Geçmişi Çek */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBackfill}
                  disabled={busy !== null}
                >
                  {busy === "backfill" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <History className="w-4 h-4 mr-2" />
                  )}
                  Geçmişi Çek
                </Button>

                {/* Kart Oku */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCaptureCard}
                  disabled={busy !== null}
                >
                  {busy === "captureCard" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Kart Oku
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchCapabilities}
                  disabled={busy !== null}
                >
                  {busy === "capabilities" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings2 className="w-4 h-4 mr-2" />
                  )}
                  Özellikleri Tara
                </Button>
              </div>

              {capabilitySnapshot && capabilityCounts && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-muted-foreground">Hikvision Özellikleri</p>
                    <span className="text-muted-foreground">
                      {new Date(capabilitySnapshot.updatedAt).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <p className="text-muted-foreground">Destekli</p>
                      <p className="font-mono text-sm">{capabilityCounts.supported}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Desteksiz</p>
                      <p className="font-mono text-sm">{capabilityCounts.unsupported}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Belirsiz</p>
                      <p className="font-mono text-sm">{capabilityCounts.unknown}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hata</p>
                      <p className="font-mono text-sm">{capabilityCounts.failed}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {capabilitySnapshot.probes.slice(0, 12).map((probe) => (
                      <div
                        key={probe.key}
                        className="flex items-center justify-between gap-2 rounded border bg-background/60 px-2 py-1"
                        title={probe.error ?? probe.endpoint}
                      >
                        <span className="truncate">{probe.label}</span>
                        <Badge
                          variant={
                            probe.supported === true
                              ? "default"
                              : probe.supported === false || !probe.ok
                                ? "destructive"
                                : "outline"
                          }
                          className="shrink-0"
                        >
                          {probe.supported === true
                            ? "Var"
                            : probe.supported === false || !probe.ok
                              ? "Yok"
                              : "Belirsiz"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {capabilitySnapshot.probes.length > 12 && (
                    <p className="text-muted-foreground">
                      +{capabilitySnapshot.probes.length - 12} özellik daha snapshot içinde saklandı.
                    </p>
                  )}
                </div>
              )}

              {/* Çalışma Durumu Paneli */}
              {workStatus && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-xs">
                  <p className="font-medium text-muted-foreground mb-1">
                    Çalışma Durumu
                    <span className="ml-2 font-normal">
                      ({new Date(workStatus.updatedAt).toLocaleTimeString("tr-TR")})
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-muted-foreground">Kapı Durumu</span>
                    <span className="font-mono">
                      {workStatus.doorStatus ? workStatus.doorStatus.join(", ") : "—"}
                    </span>
                    <span className="text-muted-foreground">Okuyucu Online</span>
                    <span className="font-mono">
                      {workStatus.cardReaderOnlineStatus
                        ? workStatus.cardReaderOnlineStatus.join(", ")
                        : "—"}
                    </span>
                    <span className="text-muted-foreground">Batarya</span>
                    <span className="font-mono">
                      {workStatus.batteryVoltage !== undefined
                        ? `${workStatus.batteryVoltage} V`
                        : "—"}
                    </span>
                    <span className="text-muted-foreground">Güç</span>
                    <span className="font-mono">
                      {workStatus.powerSupplyStatus ?? "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Son Cihaz Olayları */}
              <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <BellRing className="h-3.5 w-3.5" />
                    Son Cihaz Olayları
                  </p>
                  {recentDeviceEvents && (
                    <Badge variant="secondary" className="shrink-0">
                      {recentDeviceEvents.length}
                    </Badge>
                  )}
                </div>

                {recentDeviceEvents === undefined ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Yükleniyor
                  </div>
                ) : recentDeviceEvents.length === 0 ? (
                  <p className="text-muted-foreground">Henüz cihaz olayı yok.</p>
                ) : (
                  <div className="space-y-2">
                    {recentDeviceEvents.map((event) => (
                      <div
                        key={event._id}
                        className="rounded border bg-background/70 px-2.5 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant={deviceEventBadgeVariant(
                                event.category,
                                event.severity,
                              )}
                              className="shrink-0"
                            >
                              {deviceEventCategoryLabel(event.category)}
                            </Badge>
                            <span className="truncate font-medium">{event.label}</span>
                          </div>
                          <span className="shrink-0 text-muted-foreground">
                            {formatEventTime(event.eventTime)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                          {event.major !== undefined && <span>major:{event.major}</span>}
                          {event.minor !== undefined && <span>minor:{event.minor}</span>}
                          {event.hikSerialNo !== undefined && (
                            <span>serial:{event.hikSerialNo}</span>
                          )}
                          {event.hikEventState && <span>state:{event.hikEventState}</span>}
                          {event.cardNo && <span>card:{event.cardNo}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Eşitlik Kontrolü Paneli */}
              {reconcileResult && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-3 text-xs">
                  <p className="font-medium text-muted-foreground">Eşitlik Raporu</p>

                  {/* Kart diff */}
                  <div className="space-y-1">
                    <p className="font-medium text-xs">Kartlar</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-muted-foreground">Beklenen</span>
                      <span className="font-mono">{reconcileResult.expectedCount}</span>
                      <span className="text-muted-foreground">Cihazda</span>
                      <span className="font-mono">{reconcileResult.onDeviceCount}</span>
                    </div>
                    {reconcileResult.onDeviceNotExpected.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">
                          Cihazda fazla ({reconcileResult.onDeviceNotExpected.length}):
                        </p>
                        <p className="font-mono break-all">
                          {reconcileResult.onDeviceNotExpected.slice(0, 20).join(", ")}
                          {reconcileResult.onDeviceNotExpected.length > 20 &&
                            ` …+${reconcileResult.onDeviceNotExpected.length - 20}`}
                        </p>
                      </div>
                    )}
                    {reconcileResult.expectedNotOnDevice.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">
                          Cihazda eksik ({reconcileResult.expectedNotOnDevice.length}):
                        </p>
                        <p className="font-mono break-all">
                          {reconcileResult.expectedNotOnDevice.slice(0, 20).join(", ")}
                          {reconcileResult.expectedNotOnDevice.length > 20 &&
                            ` …+${reconcileResult.expectedNotOnDevice.length - 20}`}
                        </p>
                      </div>
                    )}
                    {reconcileResult.onDeviceNotExpected.length === 0 &&
                      reconcileResult.expectedNotOnDevice.length === 0 && (
                        <p className="text-green-600 font-medium">Kartlar senkron.</p>
                      )}
                  </div>

                  {/* Yüz diff */}
                  <div className="space-y-1 border-t pt-2">
                    <p className="font-medium text-xs">Yüz Kayıtları</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-muted-foreground">Beklenen</span>
                      <span className="font-mono">{reconcileResult.faceExpectedCount}</span>
                      <span className="text-muted-foreground">Cihazda</span>
                      <span className="font-mono">{reconcileResult.faceOnDeviceCount}</span>
                    </div>
                    {reconcileResult.faceOnDeviceNotExpected.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">
                          Cihazda fazla ({reconcileResult.faceOnDeviceNotExpected.length}):
                        </p>
                        <p className="font-mono break-all">
                          {reconcileResult.faceOnDeviceNotExpected.slice(0, 20).join(", ")}
                          {reconcileResult.faceOnDeviceNotExpected.length > 20 &&
                            ` …+${reconcileResult.faceOnDeviceNotExpected.length - 20}`}
                        </p>
                      </div>
                    )}
                    {reconcileResult.faceExpectedNotOnDevice.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">
                          Cihazda eksik ({reconcileResult.faceExpectedNotOnDevice.length}):
                        </p>
                        <p className="font-mono break-all">
                          {reconcileResult.faceExpectedNotOnDevice.slice(0, 20).join(", ")}
                          {reconcileResult.faceExpectedNotOnDevice.length > 20 &&
                            ` …+${reconcileResult.faceExpectedNotOnDevice.length - 20}`}
                        </p>
                      </div>
                    )}
                    {reconcileResult.faceOnDeviceNotExpected.length === 0 &&
                      reconcileResult.faceExpectedNotOnDevice.length === 0 && (
                        <p className="text-green-600 font-medium">Yüz kayıtları senkron.</p>
                      )}
                  </div>

                  {/* Parmak izi diff */}
                  <div className="space-y-1 border-t pt-2">
                    <p className="font-medium text-xs">Parmak İzleri</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-muted-foreground">Beklenen</span>
                      <span className="font-mono">{reconcileResult.fingerprintExpectedCount}</span>
                      <span className="text-muted-foreground">Cihazda</span>
                      <span className="font-mono">{reconcileResult.fingerprintOnDeviceCount}</span>
                    </div>
                    {reconcileResult.fingerprintOnDeviceNotExpected.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">
                          Cihazda fazla ({reconcileResult.fingerprintOnDeviceNotExpected.length}):
                        </p>
                        <p className="font-mono break-all">
                          {reconcileResult.fingerprintOnDeviceNotExpected.slice(0, 20).join(", ")}
                          {reconcileResult.fingerprintOnDeviceNotExpected.length > 20 &&
                            ` …+${reconcileResult.fingerprintOnDeviceNotExpected.length - 20}`}
                        </p>
                      </div>
                    )}
                    {reconcileResult.fingerprintExpectedNotOnDevice.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">
                          Cihazda eksik ({reconcileResult.fingerprintExpectedNotOnDevice.length}):
                        </p>
                        <p className="font-mono break-all">
                          {reconcileResult.fingerprintExpectedNotOnDevice.slice(0, 20).join(", ")}
                          {reconcileResult.fingerprintExpectedNotOnDevice.length > 20 &&
                            ` …+${reconcileResult.fingerprintExpectedNotOnDevice.length - 20}`}
                        </p>
                      </div>
                    )}
                    {reconcileResult.fingerprintOnDeviceNotExpected.length === 0 &&
                      reconcileResult.fingerprintExpectedNotOnDevice.length === 0 && (
                        <p className="text-green-600 font-medium">Parmak izleri senkron.</p>
                      )}
                  </div>
                </div>
              )}

              {/* Okunan Kart Paneli */}
              {capturedCard && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="text-muted-foreground mb-0.5">Okunan Kart No</p>
                  <p className="font-mono text-sm font-medium">{capturedCard}</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
