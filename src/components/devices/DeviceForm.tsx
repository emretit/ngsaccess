import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice, Project, AccessDirection } from "@/types/device";
import { deviceTypeMapping, DatabaseDeviceType } from "@/utils/deviceTypeMapping";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { Monitor, MapPin, Wifi, Shield, FileText, Activity } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Cihaz adı gereklidir"),
  serial_number: z.string().min(1, "Seri numarası gereklidir"),
  device_model_enum: z.enum(["QR Reader", "Fingerprint Reader", "RFID Reader", "Access Control Terminal", "Other"]),
  zone_id: z.number().optional(),
  door_id: z.number().optional(),
  access_direction: z.enum(["entry", "exit", "both"]).default("both"),
  device_mac: z.string().optional(),
  device_ip: z.string().optional(),
  device_firmware: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface DeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: ServerDevice | null;
  projects: Project[];
  onSuccess: () => void;
}

export function DeviceForm({
  open,
  onClose,
  device,
  projects,
  onSuccess,
}: DeviceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { projectIds } = useProjectAccess();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();
  
  const currentProjectId = projectIds[0] || null;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      serial_number: "",
      device_model_enum: "Other",
      access_direction: "both",
      status: "active",
      description: "",
    },
  });

  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter(door => door.zone_id === selectedZoneId);

  useEffect(() => {
    if (device && open) {
      form.reset({
        name: device.name || "",
        serial_number: device.serial_number || "",
        device_model_enum: device.device_model_enum || "Other",
        zone_id: device.zone_id,
        door_id: device.door_id,
        access_direction: (device.access_direction as AccessDirection) || "both",
        device_mac: device.device_mac || "",
        device_ip: device.device_ip || "",
        device_firmware: device.device_firmware || "",
        status: (device.status === "active" || device.status === "inactive") ? device.status : "active",
        description: device.description || "",
      });
    } else if (open) {
      form.reset({
        name: "",
        serial_number: "",
        device_model_enum: "Other",
        access_direction: "both",
        status: "active",
        description: "",
      });
    }
  }, [device, open, form]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    
    try {
      const deviceType = deviceTypeMapping[values.device_model_enum] as DatabaseDeviceType;
      
      const deviceData = {
        name: values.name,
        type: deviceType,
        device_serial: values.serial_number,
        device_model_enum: values.device_model_enum,
        project_id: currentProjectId,
        zone_id: values.zone_id || null,
        door_id: values.door_id || null,
        access_direction: values.access_direction,
        device_mac: values.device_mac || null,
        device_ip: values.device_ip || null,
        device_firmware: values.device_firmware || null,
        status: values.status,
        description: values.description || null,
      };

      if (device?.id) {
        const { error } = await supabase
          .from("devices")
          .update(deviceData)
          .eq("id", parseInt(device.id));

        if (error) throw error;
        
        toast({
          title: "Başarılı",
          description: "Cihaz bilgileri güncellendi",
        });
      } else {
        const { error } = await supabase
          .from("devices")
          .insert(deviceData);

        if (error) throw error;
        
        toast({
          title: "Başarılı",
          description: "Yeni cihaz eklendi",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b px-6 py-4 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-burgundy/10 rounded-lg">
                <Monitor className="h-5 w-5 text-burgundy" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {device ? 'Cihazı Düzenle' : 'Yeni Cihaz Ekle'}
                </h2>
                <p className="text-sm text-gray-500">
                  Cihaz bilgilerini ekleyin veya güncelleyin
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Column */}
                <div className="space-y-6">
                  
                  {/* Basic Information Card */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <Monitor className="h-5 w-5 text-burgundy" />
                        <span>Temel Bilgiler</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Cihaz Adı *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Cihaz adını giriniz" 
                                className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20"
                                {...field} 
                              />
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
                            <FormLabel className="text-sm font-medium text-gray-700">Seri Numarası *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Seri numarasını giriniz" 
                                className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20"
                                {...field} 
                              />
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
                            <FormLabel className="text-sm font-medium text-gray-700">Cihaz Modeli *</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20">
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
                    </CardContent>
                  </Card>

                  {/* Location Information Card */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <MapPin className="h-5 w-5 text-burgundy" />
                        <span>Konum Bilgileri</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="zone_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Bölge</FormLabel>
                            <Select 
                              value={field.value?.toString() || ""} 
                              onValueChange={(value) => {
                                field.onChange(value ? parseInt(value) : undefined);
                                form.setValue("door_id", undefined);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20">
                                  <SelectValue placeholder={locationLoading ? "Yükleniyor..." : "Bölge seçiniz"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {zones.map(zone => (
                                  <SelectItem key={zone.id} value={zone.id.toString()}>
                                    {zone.name}
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
                        name="door_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Kapı</FormLabel>
                            <Select 
                              value={field.value?.toString() || ""} 
                              onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                              disabled={!selectedZoneId || locationLoading}
                            >
                              <FormControl>
                                <SelectTrigger className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20">
                                  <SelectValue 
                                    placeholder={
                                      !selectedZoneId 
                                        ? "Önce bölge seçiniz" 
                                        : filteredDoors.length === 0 
                                          ? "Seçili bölgede kapı yok" 
                                          : "Kapı seçiniz"
                                    } 
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {filteredDoors.map(door => (
                                  <SelectItem key={door.id} value={door.id.toString()}>
                                    {door.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Network Information Card */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <Wifi className="h-5 w-5 text-burgundy" />
                        <span>Ağ Bilgileri</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="device_mac"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">MAC Adresi</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="00:00:00:00:00:00" 
                                className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20"
                                {...field} 
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
                            <FormLabel className="text-sm font-medium text-gray-700">IP Adresi</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="192.168.1.100" 
                                className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="device_firmware"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Firmware Versiyonu</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="v1.0.0" 
                                className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  
                  {/* Device Status Card */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <Activity className="h-5 w-5 text-burgundy" />
                        <span>Cihaz Durumu</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Activity className="h-4 w-4 text-burgundy" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Aktif Durum</p>
                            <p className="text-sm text-gray-500">Cihazın çalışma durumu</p>
                          </div>
                        </div>
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-3">
                              <FormControl>
                                <Switch
                                  checked={field.value === "active"}
                                  onCheckedChange={(checked) => 
                                    field.onChange(checked ? "active" : "inactive")
                                  }
                                />
                              </FormControl>
                              <Label className="text-sm font-medium text-gray-700">
                                {field.value === "active" ? "Aktif" : "Pasif"}
                              </Label>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Access Control Card */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <Shield className="h-5 w-5 text-burgundy" />
                        <span>Erişim Kontrolü</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="access_direction"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Erişim Yönü</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="space-y-3"
                              >
                                <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-burgundy/30 transition-all duration-200">
                                  <RadioGroupItem value="entry" id="entry" />
                                  <div className="flex-1">
                                    <Label htmlFor="entry" className="font-medium cursor-pointer text-gray-900">
                                      Giriş
                                    </Label>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Sadece giriş kontrolü
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-burgundy/30 transition-all duration-200">
                                  <RadioGroupItem value="exit" id="exit" />
                                  <div className="flex-1">
                                    <Label htmlFor="exit" className="font-medium cursor-pointer text-gray-900">
                                      Çıkış
                                    </Label>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Sadece çıkış kontrolü
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-burgundy/30 transition-all duration-200">
                                  <RadioGroupItem value="both" id="both" />
                                  <div className="flex-1">
                                    <Label htmlFor="both" className="font-medium cursor-pointer text-gray-900">
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
                    </CardContent>
                  </Card>

                  {/* Description Card */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <FileText className="h-5 w-5 text-burgundy" />
                        <span>Açıklama</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder="Cihaz hakkında detaylı açıklama yazın..." 
                                rows={5}
                                className="border-gray-200 focus:border-burgundy focus:ring-burgundy/20 resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="border-t bg-white px-6 py-4 flex-shrink-0">
            <div className="max-w-6xl mx-auto flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isLoading}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                İptal
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="bg-burgundy hover:bg-burgundy/90 text-white shadow-sm"
              >
                {isLoading ? "Kaydediliyor..." : device ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
