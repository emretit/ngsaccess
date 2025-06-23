
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
    <div className="h-full bg-white">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Device Icon Section */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <div className="w-8 h-8 bg-gray-400 rounded"></div>
                </div>
                <span className="text-sm text-gray-500">Cihaz ikonu</span>
              </div>

              {/* Basic Information Section */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ad *</FormLabel>
                      <FormControl>
                        <Input placeholder="Cihaz adı" {...field} />
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
                      <FormLabel>Şirket</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Cihaz modeli seçin" />
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serial_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Soyad *</FormLabel>
                      <FormControl>
                        <Input placeholder="Seri numarası" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zone_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departman</FormLabel>
                      <Select 
                        value={field.value?.toString() || ""} 
                        onValueChange={(value) => {
                          field.onChange(value ? parseInt(value) : undefined);
                          form.setValue("door_id", undefined);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={locationLoading ? "Yükleniyor..." : "Bölge seçin"} />
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="device_ip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta *</FormLabel>
                      <FormControl>
                        <Input placeholder="IP adresi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="door_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pozisyon</FormLabel>
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
                                  ? "Önce bölge seçin" 
                                  : filteredDoors.length === 0 
                                    ? "Seçili bölgede kapı yok" 
                                    : "Kapı seçin"
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="device_mac"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TC Kimlik No *</FormLabel>
                      <FormControl>
                        <Input placeholder="MAC adresi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="access_direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Erişim Kuralı</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Erişim yönü seçin" />
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="device_firmware"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kart Numarası *</FormLabel>
                      <FormControl>
                        <Input placeholder="Firmware versiyonu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Vardiya</Label>
                  <Input placeholder="Vardiya bilgisi" />
                </div>
              </div>

              {/* Notes Section */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notlar</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ek notlar..." 
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status Section */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <Label>Aktif</Label>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === "active"}
                            onCheckedChange={(checked) => 
                              field.onChange(checked ? "active" : "inactive")
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <Label>Erişim İzni</Label>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer with Buttons */}
          <div className="border-t bg-white p-6 flex-shrink-0">
            <div className="flex justify-end gap-3">
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
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                {isLoading ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
