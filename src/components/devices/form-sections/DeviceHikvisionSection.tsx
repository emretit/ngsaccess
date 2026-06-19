import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
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
  Plug,
  DoorOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";
import { DeviceHikLocalBridgeSection } from "./DeviceHikLocalBridgeSection";

/** Gateway heartbeat eşiği — bu süre içinde sinyal gelmemişse offline say. */
const HIK_ONLINE_WINDOW_MS = 5 * 60 * 1000;

interface DeviceHikvisionSectionProps {
  form: UseFormReturn<FormValues>;
  /** Edit mode'da set edilir; status badge + lifecycle aksiyonları görünür. */
  device?: ServerDevice | null;
  onUpdated?: () => void;
}

type TestResult =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok" }
  | { status: "warn"; message: string }
  | { status: "error"; message: string };

export function DeviceHikvisionSection({
  form,
  device,
  onUpdated,
}: DeviceHikvisionSectionProps) {
  const ping = useAction(api.actions.hikGatewayDevice.pingHikGateway);
  const remove = useAction(api.actions.hikGatewayDevice.removeDeviceFromGateway);
  const refresh = useAction(api.actions.hikGatewayDevice.refreshGatewayDeviceStatus);
  const openDoor = useAction(api.actions.hikGatewayDevice.remoteOpenDoor);

  const [test, setTest] = useState<TestResult>({ status: "idle" });
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const transport = form.watch("hik_transport") ?? "gateway";
  const isLocalBridge = transport === "localBridge";

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

  const handleTest = async () => {
    setTest({ status: "running" });
    try {
      const result = await ping();
      if (result.ok) {
        setTest({ status: "ok" });
        toast.success(`Gateway bağlantısı OK${result.version ? ` (${result.version})` : ""}`);
      } else {
        setTest({ status: "error", message: result.error ?? "Bilinmeyen hata" });
      }
    } catch (e) {
      setTest({ status: "error", message: (e as Error).message });
    }
  };

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {isLocalBridge ? "Yerel Bridge" : "Gateway"} Bağlantısı
        </h3>
        {renderStatusBadge()}
      </div>

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

      {isLocalBridge ? (
        <DeviceHikLocalBridgeSection
          form={form}
          device={device}
          onOpenDoor={handleOpenDoor}
          openingDoor={busy === "door"}
        />
      ) : (
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
                  <FormDescription className="text-xs">
                    Cihaz → Network → Platform Access → "Cihaz Kimliği".
                  </FormDescription>
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
                  <FormDescription className="text-xs">
                    Cihaz ISUP ayarındaki anahtarla eşleşmeli.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="device_ip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cihaz IP (LAN, opsiyonel)</FormLabel>
                <FormControl>
                  <Input placeholder="192.168.1.37" {...field} />
                </FormControl>
                <FormDescription className="text-xs">
                  Direkt ISAPI testleri için; gateway iletişimi için zorunlu değil.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap items-start gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={test.status === "running"}
            >
              {test.status === "running" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plug className="w-4 h-4 mr-2" />
              )}
              Test Bağlantısı
            </Button>

            {device?.hikDevIndex && (
              <>
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
              </>
            )}
          </div>

          {test.status === "ok" && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">Cihaz gateway'de online</span>
            </div>
          )}
          {test.status === "warn" && (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{test.message}</span>
            </div>
          )}
          {test.status === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{test.message}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
