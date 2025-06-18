
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Device } from "@/types/device";
import QRCode from 'qrcode.react';
import { Edit, Trash2, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

interface DeviceTableRowProps {
  device: Device;
  locationString: string;
  onQRClick: (device: Device) => void;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  selected: boolean;
  onSelect: (checked: boolean, deviceId: string) => void;
}

export function DeviceTableRow({
  device,
  locationString,
  onQRClick,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  selected,
  onSelect
}: DeviceTableRowProps) {

  const statusColor = device.status === 'online' 
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
    : 'bg-gray-100 text-gray-500 border-gray-200';

  const getAccessDirectionBadge = (accessDirection?: string) => {
    switch (accessDirection) {
      case 'entry':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Giriş</Badge>;
      case 'exit':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Çıkış</Badge>;
      case 'both':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Her İkisi</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(!!checked, device.id)}
        />
      </TableCell>
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
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
      </TableCell>
      <TableCell className="font-medium">{device.device_name || device.name || '-'}</TableCell>
      <TableCell className="font-mono text-xs">{device.device_serial || device.serial_number || '-'}</TableCell>
      <TableCell>{locationString || '-'}</TableCell>
      <TableCell>{device.device_type || device.type || '-'}</TableCell>
      <TableCell>
        <Badge 
          className={`${statusColor} py-1 px-3`}
          variant="outline"
        >
          {device.status === 'online' ? 'Aktif' : 'Pasif'}
        </Badge>
      </TableCell>
      <TableCell>{getAccessDirectionBadge(device.access_direction)}</TableCell>
      <TableCell>{device.device_mac || '-'}</TableCell>
      <TableCell>{device.device_ip || '-'}</TableCell>
      <TableCell>
        {device.last_used_at ? format(new Date(device.last_used_at), 'dd.MM.yyyy HH:mm') : '-'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditDevice(device);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Düzenle</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssignLocation(device);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Konum Ata</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-muted text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDevice(device.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Sil</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}
