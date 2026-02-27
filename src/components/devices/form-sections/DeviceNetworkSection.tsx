
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

interface DeviceNetworkSectionProps {
  form: UseFormReturn<{ device_type?: string; device_ip?: string }>;
  isNewDevice?: boolean;
}

export function DeviceNetworkSection({ form, isNewDevice }: DeviceNetworkSectionProps) {
  const deviceType = form.watch("device_type");
  const isHikvisionRelevant =
    deviceType === "Erişim Terminali" ||
    deviceType === "Kart Okuyucu" ||
    deviceType === "Yüz Tanıma";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pb-2">Ağ Bilgileri</h3>

      {isNewDevice && isHikvisionRelevant && (
        <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
          <Info className="h-4 w-4" />
          <AlertTitle>Hikvision ISAPI ile Bağlantı</AlertTitle>
          <AlertDescription>
            <span className="block mb-1">
              Hikvision cihazınızı ISAPI HTTP callback ile bağlamak için:
            </span>
            <ol className="list-decimal list-inside text-xs space-y-1 mt-1">
              <li>Seri numarasını Hikvision cihazından alın (Configuration &gt; System &gt; Basic Information)</li>
              <li>IP adresini bu forma girin</li>
              <li>Kaydettikten sonra cihazda Event &gt; Linkage Method &gt; HTTP &gt; Server URL: <code className="text-xs">https://&lt;deployment&gt;.convex.site/card-reader</code></li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

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
