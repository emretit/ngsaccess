
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";

interface DeviceStatusSectionProps {
  form: UseFormReturn<any>;
}

export function DeviceStatusSection({ form }: DeviceStatusSectionProps) {
  return (
    <div className="space-y-6">
      {/* Device Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Cihaz Durumu</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Aktif Durum</p>
            <p className="text-sm text-gray-500">Cihazın çalışma durumu</p>
          </div>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Switch
                    checked={field.value === "active"}
                    onCheckedChange={(checked) => 
                      field.onChange(checked ? "active" : "inactive")
                    }
                  />
                </FormControl>
                <Label className="text-sm font-medium">
                  {field.value === "active" ? "Aktif" : "Pasif"}
                </Label>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Access Control */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Erişim Kontrolü</h3>
        
        <FormField
          control={form.control}
          name="access_direction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Erişim Yönü</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="entry" id="entry" />
                    <div className="flex-1">
                      <Label htmlFor="entry" className="font-medium cursor-pointer">
                        Giriş
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Sadece giriş kontrolü
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="exit" id="exit" />
                    <div className="flex-1">
                      <Label htmlFor="exit" className="font-medium cursor-pointer">
                        Çıkış
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Sadece çıkış kontrolü
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="both" id="both" />
                    <div className="flex-1">
                      <Label htmlFor="both" className="font-medium cursor-pointer">
                        Her İkisi
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Giriş ve çıkış kontrolü
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Description */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">Açıklama</h3>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea 
                  placeholder="Cihaz hakkında açıklama yazın..." 
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
