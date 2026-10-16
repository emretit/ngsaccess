
import { useState } from "react";
import { Device } from "@/types/device";

export function useQRCodeDialog() {
  const [selectedQR, setSelectedQR] = useState<{ serial: string; name: string } | null>(null);

  const handleQRClick = (device: Device) => {
    if (!(device.deviceSerial?.trim() || device.ideUuid?.trim())) return;
    setSelectedQR({
      serial: device.deviceSerial?.trim() || device.ideUuid?.trim() || '',
      name: device.name || 'Device QR'
    });
  };

  const handleDownloadQR = () => {
    if (!selectedQR) return;
    
    const svg = document.querySelector('#qr-large');
    if (!(svg instanceof SVGSVGElement)) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `qr-${selectedQR.name.toLowerCase().replace(/\s+/g, '-')}.svg`;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return {
    selectedQR,
    handleQRClick,
    handleDownloadQR,
    closeQRDialog: () => setSelectedQR(null)
  };
}
