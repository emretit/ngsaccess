import { deviceLabels } from "../deviceLabels";
import { PasswordField } from "@/components/shared/PasswordField";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";

interface DeviceIdeSmartSectionProps {
  form: UseFormReturn<FormValues>;
  isEdit?: boolean;
}

/**
 * IDE Smart panel bağlantı bilgileri. Panel = bölge olarak eklenir; kapı sayısı
 * kadar kapı otomatik üretilir. Komutlar her zaman MQTT (Hetzner broker + bridge)
 * üzerinden iletilir; HTTP modu kullanılmaz.
 *
 * Zorunlu: Panel UUID (tek tanımlayıcı) + kullanıcı/şifre (panel MQTT login token'ı
 * bu kimlikle alınır). IP/port yalnızca opsiyonel LAN yedeği için saklanır.
 */
export function DeviceIdeSmartSection({
  form,
  isEdit,
}: DeviceIdeSmartSectionProps) {
  return (
    <div className="space-y-4 border-t border-line pt-4">
      <h4 className="text-sm font-semibold">IDE Smart Panel</h4>

      <FormField
        control={form.control}
        name="ide_uuid"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Panel UUID</FormLabel>
            <p id="panel-uuid-help" className="text-xs text-muted-foreground">
              {deviceLabels.uuidHelp}
            </p>
            <FormControl>
              <Input
                aria-describedby="panel-uuid-help"
                placeholder="15 haneli SYSTEM.UUID"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="ide_user"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kullanıcı</FormLabel>
              <FormControl>
                <Input
                  placeholder="admin"
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
          name="ide_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Şifre</FormLabel>
              <FormControl>
                <PasswordField
                  placeholder="Panel şifresi"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="ide_door_count"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Kapı sayısı</FormLabel>
            <FormControl>
              <Input
                disabled={isEdit}
                type="number"
                placeholder="4"
                className="max-w-[10rem]"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <details className="space-y-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm">
          İsteğe bağlı LAN bilgileri
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="device_ip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{deviceLabels.optionalIp}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={deviceLabels.ipPlaceholder}
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
            name="ide_http_port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HTTP portu</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="80"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </details>
    </div>
  );
}
