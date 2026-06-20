import { useEffect, useState } from "react";
import { useAction } from "convex/react";
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
} from "lucide-react";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";
import { DeviceHikLocalBridgeSection } from "./DeviceHikLocalBridgeSection";
import {
  HIK_MODELS,
  MANUAL_MODEL_ID,
  getHikModelSpec,
} from "../../../../convex/lib/hikModels";

/** Gateway heartbeat eşiği — bu süre içinde sinyal gelmemişse offline say. */
const HIK_ONLINE_WINDOW_MS = 5 * 60 * 1000;

interface DeviceHikvisionSectionProps {
  form: UseFormReturn<FormValues>;
  /** Edit mode'da set edilir; status badge + lifecycle aksiyonları görünür. */
  device?: ServerDevice | null;
  onUpdated?: () => void;
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

  const [busy, setBusy] = useState<string | null>(null);

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
  // Cihaz modeli kapı/okuyucu sayısını belirler. Katalog modeli seçilince transport
  // ipucu da uygulanır; "manuel" seçilince kapı sayısı elle girilir.
  const selectedModel = form.watch("hik_model");
  const modelSpec = getHikModelSpec(selectedModel);
  const isManualModel = selectedModel === MANUAL_MODEL_ID;

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

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isLocalBridge ? "Yerel Bridge" : isGateway ? "Gateway" : "Hikvision"} Bağlantısı
        </h3>
        {renderStatusBadge()}
      </div>

      {/* Cihaz Modeli — kapı/okuyucu sayısı buradan türetilir. Model seçilince transport
          ipucu otomatik uygulanır; "Diğer (manuel)" kapı sayısı inputunu açar. */}
      <FormField
        control={form.control}
        name="hik_model"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz Modeli</FormLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                const spec = getHikModelSpec(value);
                if (spec?.transportHint) {
                  form.setValue("hik_transport", spec.transportHint);
                }
                // Katalog modelinde kapı sayısı modelden gelir → alanı modelin sayısına
                // sabitle (boşaltma değil): düzenlemede kaydedince localBridge hikDoorCount'u
                // varsayılana (4) düşürmesin; manuel modelde kullanıcının girdiği korunur.
                if (spec) {
                  form.setValue("hik_door_count", spec.doorCount);
                }
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Model seçin" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {HIK_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                <SelectItem value={MANUAL_MODEL_ID}>Diğer (manuel)</SelectItem>
              </SelectContent>
            </Select>
            {modelSpec && (
              <p className="text-xs text-muted-foreground">
                {modelSpec.doorCount} kapı ·{" "}
                {modelSpec.doorCount * modelSpec.defaultReadersPerDoor} okuyucu
                {modelSpec.maxReadersPerDoor > 1
                  ? " · kapı başına 2. okuyucu sonradan eklenebilir"
                  : ""}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {isManualModel && (
        <FormField
          control={form.control}
          name="hik_door_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kapı Sayısı</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="4"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

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
              </div>

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
