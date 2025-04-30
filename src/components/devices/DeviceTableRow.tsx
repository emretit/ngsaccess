
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Device } from "@/types/device";
import QRCode from 'qrcode.react';
import { Edit, Trash2, MapPin } from "lucide-react";

interface DeviceTableRowProps {
  device: Device;
  locationString: string;
  onQRClick: (device: Device) => void;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
}

export function DeviceTableRow({
  device,
  locationString,
  onQRClick,
  onDeleteDevice,
  onAssignLocation
}: DeviceTableRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div 
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onQRClick(device)}
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
      <TableCell>{locationString}</TableCell>
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
              onAssignLocation(device);
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
              onDeleteDevice(device.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
