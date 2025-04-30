
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServerDevice } from '@/types/device';
import { useToast } from '@/hooks/use-toast';

export function useServerDeviceForm(device: ServerDevice | null, onSuccess: () => void) {
  const [name, setName] = useState(device?.name || '');
  const [serialNumber, setSerialNumber] = useState(device?.serial_number || '');
  const [deviceModel, setDeviceModel] = useState<"QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other">(
    (device?.device_model_enum as any) || "QR Reader"
  );
  const [projectId, setProjectId] = useState(device?.project_id ? device.project_id.toString() : '');
  const [expiryDate, setExpiryDate] = useState(
    device?.expiry_date ? new Date(device.expiry_date).toISOString().split('T')[0] : ''
  );
  const [zoneId, setZoneId] = useState(device?.zone_id ? String(device.zone_id) : '');
  const [doorId, setDoorId] = useState(device?.door_id ? String(device.door_id) : '');
  
  // Additional fields
  const [description, setDescription] = useState(device?.description || '');
  const [ipAddress, setIpAddress] = useState(device?.device_ip || '');
  const [macAddress, setMacAddress] = useState(device?.device_mac || '');
  const [isActive, setIsActive] = useState(device?.status === 'active' || device?.status === 'online' || true);
  const [firmwareVersion, setFirmwareVersion] = useState(device?.device_firmware || '');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const deviceData: any = {
      name,
      serial_number: serialNumber,
      device_model_enum: deviceModel,
      project_id: projectId ? parseInt(projectId) : null,
      expiry_date: expiryDate || null,
      zone_id: zoneId ? parseInt(zoneId) : null,
      door_id: doorId ? parseInt(doorId) : null,
      description,
      device_ip: ipAddress,
      device_mac: macAddress,
      status: isActive ? 'active' : 'inactive',
      device_firmware: firmwareVersion,
      device_type: deviceModel,
    };

    try {
      if (device) {
        // Cihazı güncelle
        await supabase
          .from('server_devices')
          .update(deviceData)
          .eq('id', device.id);
      } else {
        // Yeni cihaz ekle
        await supabase
          .from('server_devices')
          .insert([deviceData]);
      }

      // React Query cache'ini yenile
      queryClient.invalidateQueries({ queryKey: ['server-devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      toast({
        title: `Cihaz ${device ? 'güncellendi' : 'eklendi'}`,
        description: `${name} başarıyla ${device ? 'güncellendi' : 'eklendi'}.`,
        variant: 'default'
      });
      
      onSuccess();
    } catch (error) {
      toast({
        title: 'Cihaz kaydedilirken hata oluştu',
        description: error instanceof Error ? error.message : 'Bir hata oluştu',
        variant: 'destructive'
      });
    }
  };

  return {
    name,
    setName,
    serialNumber,
    setSerialNumber,
    deviceModel,
    setDeviceModel,
    projectId,
    setProjectId,
    expiryDate,
    setExpiryDate,
    zoneId,
    setZoneId,
    doorId,
    setDoorId,
    description,
    setDescription,
    ipAddress,
    setIpAddress,
    macAddress,
    setMacAddress,
    isActive,
    setIsActive,
    firmwareVersion,
    setFirmwareVersion,
    handleSubmit
  };
}
