
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice, Project, AccessDirection } from "@/types/device";
import { deviceTypeMapping, DatabaseDeviceType } from "@/utils/deviceTypeMapping";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  
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
      console.log('Setting form data with device:', device);
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
    console.log('Submitting form with values:', values);
    
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

      console.log('Device data to be saved:', deviceData);

      if (device?.id) {
        const { error } = await supabase
          .from("devices")
          .update(deviceData)
          .eq("id", parseInt(device.id));

        if (error) throw error;
        
        console.log('Device updated successfully');
        
        // Cache'i invalidate et
        await queryClient.invalidateQueries({ queryKey: ['devices'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
        await queryClient.invalidateQueries({ queryKey: ['devices', projectIds] });
        
        toast({
          title: "Başarılı",
          description: "Cihaz bilgileri güncellendi",
        });
      } else {
        const { error } = await supabase
          .from("devices")
          .insert(deviceData);

        if (error) throw error;
        
        console.log('Device created successfully');
        
        // Cache'i invalidate et
        await queryClient.invalidateQueries({ queryKey: ['devices'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
        await queryClient.invalidateQueries({ queryKey: ['devices', projectIds] });
        
        toast({
          title: "Başarılı",
          description: "Yeni cihaz eklendi",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving device:', error);
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
    <div className="flex flex-col h-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Main Two-Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Basic Information */}
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

                  {/* Location Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Konum Bilgileri</h3>
                    
                    <FormField
                      control={form.control}
                      name="zone_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bölge</FormLabel>
                          <Select 
                            value={field.value?.toString() || ""} 
                            onValueChange={(value) => {
                              field.onChange(value ? parseInt(value) : undefined);
                              form.setValue("door_id", undefined);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
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
                          <FormLabel>Kapı</FormLabel>
                          <Select 
                            value={field.value?.toString() || ""} 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                            disabled={!selectedZoneId || locationLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
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
                  </div>

                  {/* Network Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Ağ Bilgileri</h3>
                    
                    <FormField
                      control={form.control}
                      name="device_mac"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MAC Adresi</FormLabel>
                          <FormControl>
                            <Input placeholder="00:00:00:00:00:00" {...field} />
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
                            <Input placeholder="192.168.1.100" {...field} />
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
                          <FormLabel>Firmware Versiyonu</FormLabel>
                          <FormControl>
                            <Input placeholder="v1.0.0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Right Column */}
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
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="border-t bg-white p-6 flex-shrink-0">
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isLoading}
              >
                İptal
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="bg-burgundy hover:bg-burgundy/90"
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
