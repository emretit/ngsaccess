
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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const deviceData = {
      name,
      serial_number: serialNumber,
      device_model_enum: deviceModel,
      project_id: projectId ? parseInt(projectId) : null,
      expiry_date: expiryDate || null
    };

    try {
      if (device) {
        await supabase
          .from('server_devices')
          .update(deviceData)
          .eq('id', device.id);
      } else {
        await supabase
          .from('server_devices')
          .insert([deviceData]);
      }

      queryClient.invalidateQueries({ queryKey: ['server-devices'] });
      toast({
        title: `Device ${device ? 'updated' : 'added'} successfully`,
        variant: 'default'
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error saving device',
        description: error instanceof Error ? error.message : 'An error occurred',
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
    handleSubmit
  };
}
