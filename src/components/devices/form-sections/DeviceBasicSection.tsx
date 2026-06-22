
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import { DeviceHikModelField } from "./DeviceHikModelField";

interface DeviceBasicSectionProps {
  form: UseFormReturn<FormValues>;
}

const DEVICE_TYPES = [
  "Kontrol Paneli",
  "Parmak İzi Okuyucu",
  "Yüz Tanıma",
  "Kart Okuyucu",
  "QR Kod Okuyucu"
] as const;

export function DeviceBasicSection({ form }: DeviceBasicSectionProps) {
  // Hikvision'da model seçimi cihaz adından hemen sonra gelir — model kapı/okuyucu
  // sayısını belirlediği için ilk seçilmesi gerekir (hem yeni hem düzenleme).
  const brand = form.watch("brand");

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

      {brand === "hikvision" && <DeviceHikModelField form={form} />}

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
        render={({ field }) => {
          // Kayıtlı tip standart listede yoksa (eski "Kapı Kontrolörü" vb.) onu da
          // seçeneklere ekle — aksi halde düzenlemede Select boşalır ve değer kaybolur.
          const options = field.value && !DEVICE_TYPES.includes(field.value as (typeof DEVICE_TYPES)[number])
            ? [field.value, ...DEVICE_TYPES]
            : DEVICE_TYPES;
          return (
          <FormItem>
            <FormLabel>Cihaz Tipi</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Cihaz tipini seçiniz" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
          );
        }}
      />
    </div>
  );
}
