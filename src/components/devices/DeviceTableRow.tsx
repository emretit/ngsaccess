
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Device } from "@/types/device";
import { Edit, Trash2, MapPin, QrCode } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const statusColor = device.status === 'online' 
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
    : 'bg-gray-100 text-gray-500 border-gray-200';

  const getAccessDirectionText = (direction?: string) => {
    switch (direction) {
      case 'entry': return 'Giriş';
      case 'exit': return 'Çıkış';
      case 'both': return 'Her İkisi';
      default: return 'Her İkisi';
    }
  };

  const getAccessDirectionBadge = (direction?: string) => {
    switch (direction) {
      case 'entry':
        return (
          <Badge className="bg-blue-500 text-white border-blue-500 hover:bg-blue-600">
            Giriş
          </Badge>
        );
      case 'exit':
        return (
          <Badge className="bg-orange-500 text-white border-orange-500 hover:bg-orange-600">
            Çıkış
          </Badge>
        );
      case 'both':
        return (
          <Badge className="bg-purple-500 text-white border-purple-500 hover:bg-purple-600">
            Her İkisi
          </Badge>
        );
      default:
        return (
          <Badge className="bg-purple-500 text-white border-purple-500 hover:bg-purple-600">
            Her İkisi
          </Badge>
        );
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
      <TableCell className="font-mono text-xs">{device.id}</TableCell>
      <TableCell className="font-medium">{device.device_name || device.name || '-'}</TableCell>
      <TableCell>{device.device_model || device.type || '-'}</TableCell>
      <TableCell>{zoneName || '-'}</TableCell>
      <TableCell>{doorName || '-'}</TableCell>
      <TableCell>
        {getAccessDirectionBadge(device.access_direction)}
      </TableCell>
      <TableCell>
        <Badge 
          className={`${statusColor} py-1 px-3`}
          variant="outline"
        >
          {device.status === 'online' ? 'Aktif' : 'Pasif'}
        </Badge>
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
                    onQRClick?.(device);
                  }}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>QR Kod</p>
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
