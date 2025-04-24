
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { ServerDeviceTable } from "@/components/devices/ServerDeviceTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDevices } from "@/hooks/useDevices";
import QRCode from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Download } from "lucide-react";
import { ZoneDoorTreePanel } from "@/components/access-control/ZoneDoorTreePanel";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { AssignLocationForm } from "@/components/devices/AssignLocationForm";

export default function Devices() {
  const { devices, isLoading, addDevice, isAddingDevice } = useDevices();
  const [selectedQR, setSelectedQR] = useState<{ serial: string; name: string } | null>(null);
  const { zones, doors } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const filteredDevices = devices.filter(device => {
    if (selectedDoorId) {
      return device.door_id === selectedDoorId;
    }
    if (selectedZoneId) {
      return device.zone_id === selectedZoneId;
    }
    return true;
  });

  const handleQRClick = (device: any) => {
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

  const handleDeviceClick = (device: any) => {
    // Bu fonksiyon ileride cihaz düzenleme işlemi için kullanılabilir
    console.log("Device clicked:", device);
  };

  function getLocationString(device: any) {
    const zone = zones.find(z => String(z.id) === String(device.zone_id));
    const door = doors.find(d => String(d.id) === String(device.door_id));
    
    if (zone && door) return `${zone.name} / ${door.name}`;
    if (zone) return zone.name;
    if (door) return door.name;
    
    return device.device_location || device.location || '-';
  }

  // Cihaz seçim işlemleri için yardımcı fonksiyonlar
  const handleSelectAllDevices = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(filteredDevices.map(device => device.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (checked: boolean, deviceId: string) => {
    if (checked) {
      setSelectedDevices(prev => [...prev, deviceId]);
    } else {
      setSelectedDevices(prev => prev.filter(id => id !== deviceId));
    }
  };

  // Toplu işlemler için
  const handleBulkAction = (action: string) => {
    console.log(`Performing ${action} on devices:`, selectedDevices);
    // İleride buraya gerçek işlemler eklenecek
  };

  return (
    <main className="p-0">
      <div className="max-w-7xl mx-auto flex gap-6">
        <ZoneDoorTreePanel 
          onSelectZone={setSelectedZoneId} 
          onSelectDoor={setSelectedDoorId}
        />
        <div className="flex-1 space-y-6 p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">Cihazlar</h1>
            <div className="flex items-center gap-2">
              {selectedDevices.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('delete')}
                    className="text-red-500 border-red-500 hover:bg-red-50"
                  >
                    Seçilenleri Sil ({selectedDevices.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('assign')}
                  >
                    Konum Ata
                  </Button>
                </div>
              )}
              <DeviceForm onAddDevice={addDevice} isLoading={isAddingDevice} />
            </div>
          </div>

          <ServerDeviceTable 
            devices={filteredDevices}
            isLoading={isLoading}
            onDeviceClick={handleDeviceClick}
            zones={zones}
            doors={doors}
          />

          <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
            <DialogContent className="sm:max-w-md flex flex-col items-center">
              <DialogHeader>
                <DialogTitle className="text-center">
                  {selectedQR?.name} QR Kodu
                </DialogTitle>
              </DialogHeader>
              {selectedQR && (
                <div className="space-y-4">
                  <QRCode
                    id="qr-large"
                    value={selectedQR.serial}
                    size={256}
                    level="H"
                    className="rounded"
                  />
                  <Button 
                    className="w-full" 
                    onClick={handleDownloadQR}
                  >
                    <Download className="mr-2" />
                    QR Kodunu İndir
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </main>
  );
}
