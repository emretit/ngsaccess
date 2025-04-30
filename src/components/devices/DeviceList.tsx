import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Device } from "@/types/device";
import { Zone, Door } from "@/hooks/useZonesAndDoors";
import { DeviceTableRow } from "@/components/devices/DeviceTableRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface DeviceListProps {
  devices: Device[];
  filteredDevices: Device[];
  isLoading: boolean;
  zones: Zone[];
  doors: Door[];
  onQRClick: (device: Device) => void;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
}

export function DeviceList({
  devices,
  filteredDevices,
  isLoading,
  zones,
  doors,
  onQRClick,
  onDeleteDevice,
  onAssignLocation
}: DeviceListProps) {

  function getLocationString(device: Device) {
    const zone = zones.find(z => String(z.id) === String(device.zone_id));
    const door = doors.find(d => String(d.id) === String(device.door_id));
    
    if (zone && door) return `${zone.name} / ${door.name}`;
    if (zone) return zone.name;
    if (door) return door.name;
    
    return device.device_location || device.location || '-';
  }

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="bg-muted/30 pb-2">
        <CardTitle className="text-xl font-semibold text-primary flex items-center justify-between">
          <span>Cihaz Listesi</span>
          <Badge variant="outline" className="ml-2">
            {filteredDevices.length} / {devices.length} Cihaz
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead>QR Kod</TableHead>
                <TableHead>İsim</TableHead>
                <TableHead>Seri No</TableHead>
                <TableHead>Konum</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son Görülme</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                      <span className="text-muted-foreground">Cihazlar yükleniyor...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length > 0 ? (
                filteredDevices.map((device) => (
                  <DeviceTableRow
                    key={device.id}
                    device={device}
                    locationString={getLocationString(device)}
                    onQRClick={onQRClick}
                    onDeleteDevice={onDeleteDevice}
                    onAssignLocation={onAssignLocation}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-muted-foreground">
                        {devices.length > 0 
                          ? "Filtrelere uygun cihaz bulunamadı" 
                          : "Henüz cihaz bulunmuyor"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {devices.length > 0 
                          ? "Lütfen filtrelerinizi değiştirip tekrar deneyin" 
                          : "Yeni cihaz eklemek için 'Yeni Cihaz Ekle' butonuna tıklayın"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
