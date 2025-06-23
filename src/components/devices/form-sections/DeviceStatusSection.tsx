
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";

interface DeviceStatusSectionProps {
  form: UseFormReturn<any>;
}

export function DeviceStatusSection({ form }: DeviceStatusSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium border-b pb-2">Durum ve Açıklama</h3>
      
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Durum</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Durum seçiniz" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Açıklama</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Cihaz hakkında açıklama giriniz"
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
