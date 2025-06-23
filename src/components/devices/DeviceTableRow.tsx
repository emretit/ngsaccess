
import { format } from 'date-fns';
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Device } from "@/types/device";
import { Edit2, Trash2, MapPin, QrCode } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface DeviceTableRowProps {
  device: Device;
  zoneName?: string;
  doorName?: string;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onQRClick?: (device: Device) => void;
  selected: boolean;
  onSelect: (checked: boolean, deviceId: string) => void;
}

export function DeviceTableRow({
  device,
  zoneName,
  doorName,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onQRClick,
  selected,
  onSelect
}: DeviceTableRowProps) {
  const getStatusBadge = (status: 'online' | 'offline' | 'expired') => {
    switch (status) {
      case 'online':
        return <Badge variant="success">Çevrimiçi</Badge>;
      case 'offline':
        return <Badge variant="secondary">Çevrimdışı</Badge>;
      case 'expired':
        return <Badge variant="destructive">Süresi Dolmuş</Badge>;
      default:
        return <Badge variant="secondary">Bilinmiyor</Badge>;
    }
  };

  const getAccessDirectionText = (direction?: string) => {
    switch (direction) {
      case 'entry':
        return 'Giriş';
      case 'exit':
        return 'Çıkış';
      case 'both':
        return 'Giriş/Çıkış';
      default:
        return '-';
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Delete button clicked for device:', device.id);
    onDeleteDevice(device.id);
  };

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={(e) => {
        // Prevent row click when clicking on checkbox or buttons
        if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return;
        onEditDevice(device);
      }}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked as boolean, device.id)}
        />
      </TableCell>
      <TableCell className="font-medium">{device.id}</TableCell>
      <TableCell>{device.name || device.device_name || '-'}</TableCell>
      <TableCell>{device.device_model || device.device_type || '-'}</TableCell>
      <TableCell>{zoneName || '-'}</TableCell>
      <TableCell>{doorName || '-'}</TableCell>
      <TableCell>{getAccessDirectionText(device.access_direction)}</TableCell>
      <TableCell>{getStatusBadge(device.status)}</TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {onQRClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onQRClick(device)}
              className="h-8 w-8"
              title="QR Kod"
            >
              <QrCode className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAssignLocation(device)}
            className="h-8 w-8"
            title="Konum Ata"
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEditDevice(device)}
            className="h-8 w-8"
            title="Düzenle"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteClick}
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
