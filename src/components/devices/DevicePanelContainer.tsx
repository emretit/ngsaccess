
import { useState } from "react";
import { ServerDevice, Device } from "@/types/device";
import { DeviceDetailsPanel } from "@/components/devices/DeviceDetailsPanel";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DevicePanelContainerProps {
  onSuccess: () => void;
}

export function DevicePanelContainer({ onSuccess }: DevicePanelContainerProps) {
  const [devicePanel, setDevicePanel] = useState<{
    open: boolean;
    device: ServerDevice | null;
  }>({
    open: false,
    device: null
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const openDevicePanel = (device: ServerDevice | null = null) => {
    setDevicePanel({
      open: true,
      device
    });
  };

  const handleDevicePanelSuccess = () => {
    setDevicePanel({ open: false, device: null });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    
    toast({
      title: "İşlem başarılı",
      description: "Cihaz bilgileri kaydedildi",
    });

    onSuccess();
  };

  const handleDeviceEditClick = (device: Device) => {
    // Convert regular device to server device format for the form
    const serverDevice: ServerDevice = {
      id: device.id,
      name: device.name || device.device_name || '',
      serial_number: device.serial_number || device.device_serial || '',
      device_model_enum: "Other",
      date_added: device.created_at || new Date().toISOString(),
      status: device.status || 'online',
      zone_id: device.zone_id,
      door_id: device.door_id
    };
    
    openDevicePanel(serverDevice);
  };

  return {
    devicePanel,
    openDevicePanel,
    handleDevicePanelSuccess,
    handleDeviceEditClick,
    closeDevicePanel: () => setDevicePanel({ open: false, device: null })
  };
}
