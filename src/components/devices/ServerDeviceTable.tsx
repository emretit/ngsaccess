
import React from 'react';
import { format } from 'date-fns';
import { Edit, Trash2 } from 'lucide-react';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ServerDevice } from '@/types/device';
import { Zone, Door } from '@/hooks/useZonesAndDoors';
import { Badge } from '@/components/ui/badge';

interface ServerDeviceTableProps {
  devices: ServerDevice[];
  isLoading: boolean;
  onDeviceClick: (device: ServerDevice) => void;
  zones: Zone[];
  doors: Door[];
  onDeleteDevice?: (device: ServerDevice) => void;
}

export function ServerDeviceTable({ 
  devices, 
  isLoading, 
  onDeviceClick, 
  zones, 
  doors,
  onDeleteDevice 
}: ServerDeviceTableProps) {
  // Helper function to get location display string
  function getLocationString(device: ServerDevice) {
    // Find ids as string or number; handle cases where id might be undefined
    const zone = zones.find(z => String(z.id) === String(device.zone_id));
    const door = doors.find(d => String(d.id) === String(device.door_id));
    if (zone && door) return `${zone.name} / ${door.name}`;
    if (zone) return zone.name;
    if (door) return door.name;
    return "-";
  }

  // Get device status class and text
  function getStatusBadge(device: ServerDevice) {
    if (!device.status || device.status === 'active') {
      return <Badge variant="success">Aktif</Badge>;
    } else if (device.status === 'inactive') {
      return <Badge variant="secondary">Pasif</Badge>;
    } else if (device.status === 'maintenance') {
      return <Badge variant="warning">Bakımda</Badge>;
    } else {
      return <Badge variant="outline">{device.status}</Badge>;
    }
  }

  // Format date function with null check
  function formatDateSafe(dateString: string | undefined | null) {
    return dateString ? format(new Date(dateString), 'dd.MM.yyyy') : '-';
  }

  const handleActionClick = (e: React.MouseEvent, callback: () => void) => {
    e.stopPropagation(); // Prevent row click when clicking action buttons
    callback();
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Seri Numarası</TableHead>
            <TableHead>İsim</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Proje</TableHead>
            <TableHead>Konum (Bölge/Kapı)</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Eklenme Tarihi</TableHead>
            <TableHead>Son Kullanma Tarihi</TableHead>
            <TableHead>İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8">
                Yükleniyor...
              </TableCell>
            </TableRow>
          ) : devices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
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
                <TableCell>{getStatusBadge(device)}</TableCell>
                <TableCell>{formatDateSafe(device.date_added)}</TableCell>
                <TableCell>
                  {formatDateSafe(device.expiry_date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleActionClick(e, () => onDeviceClick(device))}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {onDeleteDevice && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => handleActionClick(e, () => onDeleteDevice(device))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
