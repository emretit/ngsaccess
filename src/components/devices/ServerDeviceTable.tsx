
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

interface ServerDeviceTableProps {
  devices: ServerDevice[];
  isLoading: boolean;
  onDeviceClick: (device: ServerDevice) => void;
}

export function ServerDeviceTable({ devices, isLoading, onDeviceClick }: ServerDeviceTableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Seri Numarası</TableHead>
            <TableHead>İsim</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Proje</TableHead>
            <TableHead>Eklenme Tarihi</TableHead>
            <TableHead>Son Kullanma Tarihi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                Yükleniyor...
              </TableCell>
            </TableRow>
          ) : devices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
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
