
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";

interface DeviceBasicSectionProps {
  form: UseFormReturn<any>;
}

export function DeviceBasicSection({ form }: DeviceBasicSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium border-b pb-2">Temel Bilgiler</h3>
      
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz Adı *</FormLabel>
            <FormControl>
              <Input placeholder="Cihaz adını giriniz" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="serial_number"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Seri Numarası *</FormLabel>
            <FormControl>
              <Input placeholder="Seri numarasını giriniz" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="device_model_enum"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz Modeli *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Cihaz modelini seçiniz" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="QR Reader">QR Okuyucu</SelectItem>
                <SelectItem value="Fingerprint Reader">Parmak İzi Okuyucu</SelectItem>
                <SelectItem value="RFID Reader">RFID Kart Okuyucu</SelectItem>
                <SelectItem value="Access Control Terminal">Geçiş Kontrol Terminali</SelectItem>
                <SelectItem value="Other">Diğer</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
