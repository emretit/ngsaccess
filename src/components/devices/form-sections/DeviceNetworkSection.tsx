import { PasswordField } from "@/components/shared/PasswordField";

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";

interface DeviceNetworkSectionProps {
  form: UseFormReturn<FormValues>;
}

export function DeviceNetworkSection({ form }: DeviceNetworkSectionProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="device_ip"
        render={({ field }) => (
          <FormItem>
            <FormLabel>IP adresi</FormLabel>
            <FormControl>
              <Input placeholder="192.168.1.100" {...field} />
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
              <Input placeholder="admin" {...field} />
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
              <PasswordField placeholder="Cihaz şifresi" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
