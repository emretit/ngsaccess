
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
import { Download, Edit, Trash2, MapPin } from "lucide-react";
import { ZoneDoorTreePanel } from "@/components/access-control/ZoneDoorTreePanel";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { AssignLocationForm } from "@/components/devices/AssignLocationForm";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Device } from "@/types/device";

export default function Devices() {
  const { devices, isLoading, addDevice, isAddingDevice } = useDevices();
  const [selectedQR, setSelectedQR] = useState<{ serial: string; name: string } | null>(null);
  const { zones, doors } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLocationForm, setShowLocationForm] = useState<{open: boolean; device: Device | null}>({
    open: false, 
    device: null
  });

  const filteredDevices = devices.filter(device => {
    if (selectedDoorId) {
      return device.door_id === selectedDoorId;
    }
    if (selectedZoneId) {
      return device.zone_id === selectedZoneId;
    }
    return true;
  });

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

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      toast({
        title: "Cihaz silindi",
        description: "Cihaz başarıyla silindi",
      });
      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Cihaz silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleAssignLocation = async (zoneId: number, doorId: number) => {
    if (!showLocationForm.device) return;
    
    try {
      // Update device location in database
      const { error } = await fetch(`/api/devices/${showLocationForm.device.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: zoneId,
          door_id: doorId
        })
      }).then(res => res.json());
      
      if (error) throw new Error(error);

      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      toast({
        title: "Konum atandı",
        description: "Cihaz konumu başarıyla güncellendi",
      });
      
      setShowLocationForm({open: false, device: null});
    } catch (error) {
      toast({
        title: "Hata",
        description: "Konum atanırken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  function getLocationString(device: Device) {
    const zone = zones.find(z => String(z.id) === String(device.zone_id));
    const door = doors.find(d => String(d.id) === String(device.door_id));
    
    if (zone && door) return `${zone.name} / ${door.name}`;
    if (zone) return zone.name;
    if (door) return door.name;
    
    return device.device_location || device.location || '-';
  }

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
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : filteredDevices.length > 0 ? (
                  filteredDevices.map((device) => (
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
                      <TableCell>{getLocationString(device)}</TableCell>
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Düzenleme işlemi
                              console.log('Edit device:', device.id);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Konum atama formunu aç
                              setShowLocationForm({open: true, device});
                            }}
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDevice(device.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      {selectedZoneId || selectedDoorId 
                        ? "Seçilen konumda cihaz bulunmuyor" 
                        : "Henüz cihaz bulunmuyor"}
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
          
          {/* Separate AssignLocationForm component with properly typed device */}
          {showLocationForm.device && (
            <AssignLocationForm
              open={showLocationForm.open}
              onClose={() => setShowLocationForm({open: false, device: null})}
              deviceName={showLocationForm.device?.device_name || showLocationForm.device?.name || 'Cihaz'}
              onSubmit={handleAssignLocation}
              // Instead of passing the Device object directly, just pass the necessary properties
              // that match the ServerDevice type's zone_id and door_id
              device={{
                id: showLocationForm.device.id,
                name: showLocationForm.device.name || '',
                serial_number: showLocationForm.device.serial_number || '',
                device_model_enum: "Other",
                zone_id: showLocationForm.device.zone_id,
                door_id: showLocationForm.device.door_id
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
