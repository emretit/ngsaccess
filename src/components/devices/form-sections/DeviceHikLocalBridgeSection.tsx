import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, DoorOpen } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";

interface DeviceHikLocalBridgeSectionProps {
  form: UseFormReturn<FormValues>;
  /** Edit mode'da set edilir; "Kapıyı Aç" yalnız kayıtlı cihazda görünür. */
  device?: ServerDevice | null;
  /** Kapı açma parent'ta (paylaşılan remoteOpenDoor action) yürütülür. */
  onOpenDoor: () => void;
  openingDoor: boolean;
}

/**
 * Hikvision "localBridge" transport ayarları (ör. DS-K2804). Panelin HTTP/ISAPI portu
 * yoktur; LAN'daki Windows bridge EXE Convex'ten roster/ack ile iş alır ve HCNetSDK
 * ile panele uygular.
 *
 * Tek-yer modeli: panelin IP/port/kullanıcı/şifresi BURADA (ngsplus'ta) tutulur ve
 * bridge'e otomatik iletilir. Bridge'e elle panel girilmez; yalnız bir kez "Bridge
 * Token" girilir (Ayarlar → Bridge).
 */
export function DeviceHikLocalBridgeSection({
  form,
  device,
  onOpenDoor,
  openingDoor,
}: DeviceHikLocalBridgeSectionProps) {
  return (
    <>
      {/* Kapı sayısı artık cihaz modelinden türetilir (DeviceHikvisionSection) — burada input yok. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="hik_port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SDK Port</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="8000"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="device_username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cihaz Kullanıcı Adı</FormLabel>
              <FormControl>
                <Input placeholder="admin" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="device_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cihaz Şifresi</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Panel şifresi"
                  autoComplete="new-password"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {device && (
        <div className="flex flex-wrap items-start gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenDoor}
            disabled={openingDoor}
          >
            {openingDoor ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <DoorOpen className="w-4 h-4 mr-2" />
            )}
            Kapıyı Aç
          </Button>
        </div>
      )}
    </>
  );
}
