
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
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                {devices.length > 0 
                  ? "Filtrelere uygun cihaz bulunamadı" 
                  : "Henüz cihaz bulunmuyor"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
