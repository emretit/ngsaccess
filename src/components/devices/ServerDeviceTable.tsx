
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ServerDevice } from '@/types/device';
import { type Zone, type Door } from '@/hooks/useZonesAndDoors';

interface ServerDeviceTableProps {
  devices: ServerDevice[];
  isLoading: boolean;
  onDeviceClick: (device: ServerDevice) => void;
  zones: Zone[];
  doors: Door[];
}

export function ServerDeviceTable({
  devices,
  isLoading,
  onDeviceClick,
  zones,
  doors
}: ServerDeviceTableProps) {

  // Yardımcı fonksiyon - zone ID'sine göre zone adını bul
  const getZoneName = (zoneId: number | null) => {
    if (!zoneId) return "-";
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : "-";
  };

  // Yardımcı fonksiyon - door ID'sine göre kapı adını bul
  const getDoorName = (doorId: number | null) => {
    if (!doorId) return "-";
    const door = doors.find(d => d.id === doorId);
    return door ? door.name : "-";
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge variant="success">Aktif</Badge>;
    } else if (status === "inactive") {
      return <Badge variant="destructive">Pasif</Badge>;
    } else if (status === "maintenance") {
      return <Badge variant="secondary">Bakımda</Badge>;
    }
    return <Badge>Bilinmiyor</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-burgundy" />
        <span className="ml-2">Cihazlar yükleniyor...</span>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12 border rounded-md">
        <p className="text-muted-foreground">Sistemde kayıtlı cihaz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Cihaz Adı</TableHead>
              <TableHead>Seri No</TableHead>
              <TableHead>Cihaz Tipi</TableHead>
              <TableHead>Proje</TableHead>
              <TableHead>Bölge</TableHead>
              <TableHead>Kapı</TableHead>
              <TableHead>Son Kullanma</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow
                key={device.id}
                onClick={() => onDeviceClick(device)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>{device.serial_number}</TableCell>
                <TableCell>{device.device_model_enum || "-"}</TableCell>
                <TableCell>{device.projects?.name || "-"}</TableCell>
                <TableCell>{getZoneName(device.zone_id)}</TableCell>
                <TableCell>{getDoorName(device.door_id)}</TableCell>
                <TableCell>
                  {device.expiry_date ? format(new Date(device.expiry_date), "dd.MM.yyyy") : "-"}
                </TableCell>
                <TableCell>{getStatusBadge(device.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
