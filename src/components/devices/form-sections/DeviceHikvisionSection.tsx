import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import type { UseFormReturn } from "react-hook-form";
import { api } from "../../../../convex/_generated/api";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { deviceConnection } from "@/lib/deviceStatus";
import { notify } from "@/lib/notify";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";
import { DeviceHikLocalBridgeSection } from "./DeviceHikLocalBridgeSection";

interface DeviceHikvisionSectionProps {
  form: UseFormReturn<FormValues>;
  device?: ServerDevice | null;
  onUpdated?: () => void;
}

export function DeviceHikvisionSection({ form, device: initialDevice, onUpdated }: DeviceHikvisionSectionProps) {
  const liveDevice = useQuery(api.devices.getById, initialDevice?._id ? { deviceId: initialDevice._id } : "skip");
  const device = liveDevice ?? initialDevice;
  const remove = useAction(api.actions.hikGatewayDevice.removeDeviceFromGateway);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const transport = form.watch("hik_transport");
  const connection = device ? deviceConnection(device, now) : "never";

  return (
    <div className="space-y-3 border-t pt-4">
      <ConfirmDestructive open={removeOpen} onOpenChange={setRemoveOpen}
        title="Gateway bağlantısını kaldır" objectName={device?.name ?? "Cihaz"}
        effects={["Cihaz gateway üzerinden bağlanamaz; komutlar ve olay alımı durabilir."]}
        confirmLabel="Bağlantıyı kaldır" onConfirm={async () => {
          if (!device) throw new Error("Cihaz bulunamadı");
          const result = await remove({ deviceId: device._id });
          if (!result.ok) throw new Error(result.error ?? "Gateway bağlantısı kaldırılamadı");
          notify.success("Gateway bağlantısı kaldırıldı");
          onUpdated?.();
        }} />
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Hikvision bağlantısı</h3>
        {device && <StatusBadge tone={connection === "online" ? "success" : "neutral"}>
          {connection === "online" ? "Çevrimiçi" : connection === "never" ? "Henüz bağlanmadı" : "Çevrimdışı"}
        </StatusBadge>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField control={form.control} name="hik_transport" render={({ field }) => (
          <FormItem>
            <FormLabel>İletişim Yöntemi</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="gateway">Gateway (ISUP)</SelectItem>
                <SelectItem value="localBridge">Yerel Bridge (LAN Windows EXE)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="device_ip" render={({ field }) => (
          <FormItem>
            <FormLabel>{transport === "localBridge" ? "Panel IP / sunucu adı (zorunlu)" : "Cihaz IP (opsiyonel)"}</FormLabel>
            <FormControl><Input placeholder="192.168.1.117" {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      {transport === "localBridge" ? <DeviceHikLocalBridgeSection form={form} device={device} /> : transport === "gateway" ? <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="ehome_id" render={({ field }) => (
            <FormItem><FormLabel>Ehome ID (zorunlu)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="ehome_key" render={({ field }) => (
            <FormItem><FormLabel>Şifreleme Anahtarı (zorunlu)</FormLabel><FormControl><Input type="password" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        {device?.hikOfflineHint && <p className="text-sm text-destructive">{device.hikOfflineHint}</p>}
        {device?.hikDevIndex && <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Gateway kimliği: {device.hikDevIndex}</p>
          <Button type="button" variant="destructive" size="sm" onClick={() => setRemoveOpen(true)}>Gateway bağlantısını kaldır</Button>
        </div>}
      </> : null}
      {device && <p className="text-sm text-muted-foreground">Kapı açma, özellik tarama, kart okutma ve diğer tanılama işlemleri Cihaz Merkezi sekmesindedir. Sonuçlar bu sekmede açık kalır.</p>}
    </div>
  );
}
