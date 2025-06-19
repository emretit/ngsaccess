
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Device, ServerDevice } from "@/types/device";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DeviceAccessInfo } from "./form-fields/DeviceAccessInfo";

interface AssignLocationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (device: Device, locationData: any) => void;
  deviceName: string;
  device?: ServerDevice;
}

export function AssignLocationForm({
  open,
  onClose,
  onSubmit,
  deviceName,
  device
}: AssignLocationFormProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedDoorId, setSelectedDoorId] = useState<string>("");
  const [accessDirection, setAccessDirection] = useState<"entry" | "exit" | "both">("both");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { zones, doors, loading } = useZonesAndDoors();
  const { toast } = useToast();

  // Reset form when dialog opens with device data
  useEffect(() => {
    if (open && device) {
      console.log('Setting initial values for device:', device);
      setSelectedZoneId(device.zone_id?.toString() || "");
      setSelectedDoorId(device.door_id?.toString() || "");
      setAccessDirection(device.access_direction || "both");
    } else if (open) {
      // Reset form for new assignment
      setSelectedZoneId("");
      setSelectedDoorId("");
      setAccessDirection("both");
    }
  }, [open, device?.id]); // Only depend on open and device.id to prevent loops

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!device) {
      toast({
        title: "Hata",
        description: "Cihaz bilgisi bulunamadı",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData = {
        zone_id: selectedZoneId ? parseInt(selectedZoneId) : null,
        door_id: selectedDoorId ? parseInt(selectedDoorId) : null,
        access_direction: accessDirection,
      };

      const { error } = await supabase
        .from('devices')
        .update(updateData)
        .eq('id', parseInt(device.id));

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Cihaz konumu ve erişim yönü güncellendi",
      });

      onClose();
      
      // Convert to Device format for callback
      const deviceData: Device = {
        id: device.id,
        name: device.name,
        zone_id: updateData.zone_id || undefined,
        door_id: updateData.door_id || undefined,
        access_direction: accessDirection,
        status: device.status || 'online'
      };
      
      onSubmit(deviceData, updateData);
    } catch (error: any) {
      console.error('Error updating device location:', error);
      toast({
        title: "Hata",
        description: error.message || "Konum güncellenirken hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDoors = doors.filter(door => 
    !selectedZoneId || door.zone_id?.toString() === selectedZoneId
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konum Ata: {deviceName}</DialogTitle>
          <DialogDescription>
            Cihaza konum ve erişim yönü atayın
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zone">Bölge</Label>
            <Select value={selectedZoneId} onValueChange={setSelectedZoneId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Bölge seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Bölge seçmeyin</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id.toString()}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="door">Kapı</Label>
            <Select 
              value={selectedDoorId} 
              onValueChange={setSelectedDoorId} 
              disabled={loading || !selectedZoneId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kapı seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kapı seçmeyin</SelectItem>
                {filteredDoors.map((door) => (
                  <SelectItem key={door.id} value={door.id.toString()}>
                    {door.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DeviceAccessInfo
            accessDirection={accessDirection}
            onAccessDirectionChange={setAccessDirection}
            disabled={isSubmitting}
          />

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
