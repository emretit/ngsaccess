import { PasswordField } from "@/components/shared/PasswordField";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";

interface DeviceHikLocalBridgeSectionProps {
  form: UseFormReturn<FormValues>;
  device?: ServerDevice | null;
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
              <FormLabel>SDK portu</FormLabel>
              <FormControl>
                <Input
                  readOnly
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
              <FormLabel>Cihaz kullanıcı adı</FormLabel>
              <FormControl>
                <Input readOnly placeholder="admin" {...field} value={field.value ?? ""} />
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
              <FormLabel>Cihaz şifresi</FormLabel>
              <FormControl>
                <PasswordField
                  readOnly
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


    </>
  );
}
