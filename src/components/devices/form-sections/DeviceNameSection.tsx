import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";

interface DeviceNameSectionProps {
  form: UseFormReturn<FormValues>;
}

/** IDE Smart paneli için panel adı — bölge AYRI alandır (DeviceZoneSection). */
export function DeviceNameSection({ form }: DeviceNameSectionProps) {
  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Panel Adı</FormLabel>
          <FormControl>
            <Input placeholder="Örn. Ana Giriş Paneli" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
