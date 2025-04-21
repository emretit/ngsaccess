
import { format } from 'date-fns';
import { Plus } from "lucide-react";
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

export default function Devices() {
  // Use the custom hook to fetch and manage devices
  const { 
    devices, 
    isLoading, 
    addDevice, 
    isAddingDevice 
  } = useDevices(); 

  console.log("Devices data:", devices); // Add logging to debug

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Cihazlar</h1>
          <DeviceForm onAddDevice={addDevice} isLoading={isAddingDevice} />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={6} className="text-center py-8">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              ) : devices && devices.length > 0 ? (
                devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono">{device.serial_number}</TableCell>
                    <TableCell>{device.device_location || '-'}</TableCell>
                    <TableCell>{device.device_type || '-'}</TableCell>
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
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Henüz cihaz bulunmuyor
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
