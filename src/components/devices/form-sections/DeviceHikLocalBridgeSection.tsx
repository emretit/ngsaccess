import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
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
 * yoktur; LAN'daki Windows bridge EXE Convex'ten poll/ack ile iş alır ve HCNetSDK
 * (port 8000) ile panele uygular. Bridge, cihazın API token'ı ile kimlik doğrular.
 */
export function DeviceHikLocalBridgeSection({
  form,
  device,
  onOpenDoor,
  openingDoor,
}: DeviceHikLocalBridgeSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3">
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
              <FormDescription className="text-xs">1–8 (DS-K2804: 4)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="device_ip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Panel IP (LAN)</FormLabel>
              <FormControl>
                <Input placeholder="192.168.1.117" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription className="text-xs">Bridge SDK port 8000 ile bağlanır</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Bridge, cihazın API token'ı ile doğrular — aşağıdaki token kartından kopyalayıp bridge'e girin.
      </p>

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
