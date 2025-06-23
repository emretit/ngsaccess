
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";

interface DeviceNetworkSectionProps {
  form: UseFormReturn<any>;
}

export function DeviceNetworkSection({ form }: DeviceNetworkSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium border-b pb-2">Ağ Bilgileri</h3>
      
      <FormField
        control={form.control}
        name="device_ip"
        render={({ field }) => (
          <FormItem>
            <FormLabel>IP Adresi</FormLabel>
            <FormControl>
              <Input placeholder="192.168.1.100" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
