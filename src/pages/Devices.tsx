import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { DeviceForm } from "@/components/devices/DeviceForm";
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

export default function Devices() {
  const { 
    devices, 
    isLoading, 
    addDevice, 
    isAddingDevice 
  } = useDevices();
  
  const [selectedQR, setSelectedQR] = useState<{
    serial: string;
    name: string;
  } | null>(null);

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

  return (
    <main className="p-0">
      <div className="max-w-7xl mx-auto flex gap-6">
        <ZoneDoorTreePanel />
        <div className="flex-1 space-y-6 p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">Cihazlar</h1>
            <DeviceForm onAddDevice={addDevice} isLoading={isAddingDevice} />
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QR Kod</TableHead>
                  <TableHead>İsim</TableHead>
                  <TableHead>Seri No</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son Görülme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : devices && devices.length > 0 ? (
                  devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div 
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleQRClick(device)}
                        >
                          <QRCode
                            value={device.device_serial || device.serial_number || ''}
                            size={64}
                            level="H"
                            className="rounded"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{device.device_name || device.name}</TableCell>
                      <TableCell className="font-mono">{device.device_serial || device.serial_number}</TableCell>
                      <TableCell>{device.device_location || device.location || '-'}</TableCell>
                      <TableCell>{device.device_type || device.type || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={device.status === 'online' ? 'success' : 'secondary'}
                        >
                          {device.status === 'online' ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {device.created_at ? format(new Date(device.created_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Henüz cihaz bulunmuyor
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

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
