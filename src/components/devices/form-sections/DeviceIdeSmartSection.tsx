import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";

interface DeviceIdeSmartSectionProps {
  form: UseFormReturn<FormValues>;
}

/**
 * IDE Smart panel bağlantı bilgileri. Panel = bölge olarak eklenir; kapı sayısı
 * kadar kapı otomatik üretilir. Komutlar her zaman MQTT (Hetzner broker + bridge)
 * üzerinden iletilir; HTTP modu kullanılmaz.
 *
 * Zorunlu: Panel UUID (tek tanımlayıcı) + kullanıcı/şifre (panel MQTT login token'ı
 * bu kimlikle alınır). IP/port yalnızca opsiyonel LAN yedeği için saklanır.
 */
export function DeviceIdeSmartSection({ form }: DeviceIdeSmartSectionProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <h4 className="text-sm font-semibold">IDE Smart Panel</h4>

      <FormField
        control={form.control}
        name="ide_uuid"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Panel UUID</FormLabel>
            <FormControl>
              <Input placeholder="ör. 289833329732592" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="ide_user"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kullanıcı</FormLabel>
              <FormControl>
                <Input placeholder="admin" {...field} value={field.value ?? ""} />
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
                <Input type="password" placeholder="Panel şifresi" {...field} value={field.value ?? ""} />
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
            <FormLabel>Kapı Sayısı</FormLabel>
            <FormControl>
              <Input type="number" placeholder="4" className="max-w-[10rem]" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4 rounded-md border border-dashed bg-background/40 p-3">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="device_ip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Panel IP Adresi</FormLabel>
                <FormControl>
                  <Input placeholder="192.168.1.100" {...field} value={field.value ?? ""} />
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
                <FormLabel>HTTP Port</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="80" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
