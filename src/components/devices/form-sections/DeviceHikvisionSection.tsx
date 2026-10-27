import { deviceLabels } from "../deviceLabels";
import { PasswordField } from "@/components/shared/PasswordField";
import type { UseFormReturn } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { ServerDevice } from "@/types/device";
import { DeviceHikLocalBridgeSection } from "./DeviceHikLocalBridgeSection";

interface DeviceHikvisionSectionProps {
  form: UseFormReturn<FormValues>;
  device?: ServerDevice | null;
}
export function DeviceHikvisionSection({
  form,
  device,
}: DeviceHikvisionSectionProps) {
  const legacyBridge = device?.hikTransport === "localBridge";
  const transport = form.watch("hik_transport");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="hik_transport"
          render={({ field }) => (
            <FormItem>
              <FormLabel>İletişim yöntemi</FormLabel>
              <Select disabled={legacyBridge} onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="gateway">Gateway (ISUP)</SelectItem>
                  {legacyBridge && <SelectItem value="localBridge">Yerel köprü (LAN) — salt okunur</SelectItem>}
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
              <FormLabel>
                {transport === "localBridge"
                  ? "IP adresi / sunucu adı (zorunlu)"
                  : deviceLabels.optionalIp}
              </FormLabel>
              <FormControl>
                <Input
                  readOnly={legacyBridge}
                  placeholder={deviceLabels.ipPlaceholder}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {transport === "localBridge" ? (
        <DeviceHikLocalBridgeSection form={form} device={device} />
      ) : transport === "gateway" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="ehome_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ehome ID (zorunlu)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
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
                  <FormLabel>Şifreleme anahtarı (zorunlu)</FormLabel>
                  <FormControl>
                    <PasswordField {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {device?.hikOfflineHint && (
            <p className="text-sm text-destructive">{device.hikOfflineHint}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
