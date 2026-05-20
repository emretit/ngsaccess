
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";

interface DeviceBasicSectionProps {
  form: UseFormReturn<FormValues>;
}

const DEVICE_TYPES = [
  "Kart Okuyucu",
  "Parmak İzi Okuyucu", 
  "Yüz Tanıma",
  "QR Kod Okuyucu",
  "RFID Okuyucu",
  "Erişim Terminali",
  "Turnike",
  "Kapı Kontrolörü",
  "Diğer"
] as const;

export function DeviceBasicSection({ form }: DeviceBasicSectionProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz Adı</FormLabel>
            <FormControl>
              <Input placeholder="Cihaz adını giriniz" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="device_serial"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Seri Numarası</FormLabel>
            <FormControl>
              <Input placeholder="Seri numarasını giriniz" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="device_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz Tipi</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Cihaz tipini seçiniz" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {DEVICE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="access_direction"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Erişim Yönü</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Erişim yönünü seçiniz" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="entry">Giriş</SelectItem>
                <SelectItem value="exit">Çıkış</SelectItem>
                <SelectItem value="both">Her İkisi</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
