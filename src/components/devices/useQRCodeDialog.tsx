
import { useState } from "react";
import { Device } from "@/types/device";

export function useQRCodeDialog() {
  const [selectedQR, setSelectedQR] = useState<{ serial: string; name: string } | null>(null);

  const handleQRClick = (device: Device) => {
    setSelectedQR({
      serial: device.device_serial || device.serial_number || '',
      name: device.device_name || device.name || 'Device QR'
    });
  };

  const handleDownloadQR = () => {
    if (!selectedQR) return;
    
    const canvas = document.querySelector('#qr-large') as HTMLCanvasElement;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `qr-${selectedQR.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return {
    selectedQR,
    handleQRClick,
    handleDownloadQR,
    closeQRDialog: () => setSelectedQR(null)
  };
}
