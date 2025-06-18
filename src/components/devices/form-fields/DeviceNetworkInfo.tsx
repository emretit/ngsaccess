
import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface DeviceNetworkInfoProps {
  form: UseFormReturn<any>;
}

export function DeviceNetworkInfo({ form }: DeviceNetworkInfoProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Ağ ve Donanım Bilgileri</h3>
        <p className="text-sm text-muted-foreground">
          Cihazın ağ ve donanım bilgilerini giriniz (isteğe bağlı)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="device_mac"
          render={({ field }) => (
            <FormItem>
              <FormLabel>MAC Adresi</FormLabel>
              <FormControl>
                <Input 
                  placeholder="00:00:00:00:00:00" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="device_ip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IP Adresi</FormLabel>
              <FormControl>
                <Input 
                  placeholder="192.168.1.100" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="device_firmware"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Firmware Versiyonu</FormLabel>
            <FormControl>
              <Input 
                placeholder="v1.0.0" 
                {...field} 
                value={field.value || ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
