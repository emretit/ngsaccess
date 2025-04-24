
import { format } from 'date-fns';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { ServerDevice } from '@/types/device';
import { Zone, Door } from '@/hooks/useZonesAndDoors';

interface ServerDeviceTableProps {
  devices: ServerDevice[];
  isLoading: boolean;
  onDeviceClick: (device: ServerDevice) => void;
  zones: Zone[];
  doors: Door[];
}

export function ServerDeviceTable({ devices, isLoading, onDeviceClick, zones, doors }: ServerDeviceTableProps) {
  // Helper function to get location display string
  function getLocationString(device: ServerDevice) {
    // Find ids as string or number; handle cases where id might be undefined
    const zone = zones.find(z => String(z.id) === String(device["zone_id"]));
    const door = doors.find(d => String(d.id) === String(device["door_id"]));
    if (zone && door) return `${zone.name} / ${door.name}`;
    if (zone) return zone.name;
    if (door) return door.name;
    return "-";
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Seri Numarası</TableHead>
            <TableHead>İsim</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Proje</TableHead>
            <TableHead>Konum</TableHead>
            <TableHead>Eklenme Tarihi</TableHead>
            <TableHead>Son Kullanma Tarihi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                Yükleniyor...
              </TableCell>
            </TableRow>
          ) : devices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                Cihaz bulunamadı
              </TableCell>
            </TableRow>
          ) : (
            devices.map((device) => (
              <TableRow
                key={device.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onDeviceClick(device)}
              >
                <TableCell className="font-mono">{device.serial_number}</TableCell>
                <TableCell>{device.name}</TableCell>
                <TableCell>{device.device_model_enum}</TableCell>
                <TableCell>{device.projects?.name || '-'}</TableCell>
                <TableCell>{getLocationString(device)}</TableCell>
                <TableCell>{device.date_added ? format(new Date(device.date_added), 'dd.MM.yyyy') : '-'}</TableCell>
                <TableCell>
                  {device.expiry_date 
                    ? format(new Date(device.expiry_date), 'dd.MM.yyyy')
                    : '-'
                  }
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
