import React, { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

interface ServerDeviceTableProps {
  devices: ServerDevice[];
  isLoading: boolean;
  onDeviceClick: (device: ServerDevice) => void;
  zones: Zone[];
  doors: Door[];
}

export function ServerDeviceTable({ devices, isLoading, onDeviceClick, zones, doors }: ServerDeviceTableProps) {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(devices.map(device => device.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (checked: boolean, deviceId: string) => {
    if (checked) {
      setSelectedDevices(prev => [...prev, deviceId]);
    } else {
      setSelectedDevices(prev => prev.filter(id => id !== deviceId));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedDevices.length === devices.length && devices.length > 0}
                onCheckedChange={handleSelectAll}
                aria-label="Select all devices"
              />
            </TableHead>
            <TableHead>Seri Numarası</TableHead>
            <TableHead>İsim</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Proje</TableHead>
            <TableHead>Konum</TableHead>
            <TableHead>Eklenme Tarihi</TableHead>
            <TableHead>Son Kullanma Tarihi</TableHead>
            <TableHead className="w-[100px]">İşlemler</TableHead>
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
                className={`hover:bg-gray-50 transition-colors ${
                  selectedDevices.includes(device.id) ? 'bg-gray-50' : ''
                }`}
              >
                <TableCell className="w-[50px]">
                  <Checkbox
                    checked={selectedDevices.includes(device.id)}
                    onCheckedChange={(checked) => handleSelectDevice(checked as boolean, device.id)}
                    aria-label={`Select device ${device.name}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="font-mono">{device.serial_number}</TableCell>
                <TableCell>{device.name}</TableCell>
                <TableCell>{device.device_model_enum}</TableCell>
                <TableCell>{device.projects?.name || '-'}</TableCell>
                <TableCell>{getLocationString(device)}</TableCell>
                <TableCell>
                  {device.date_added ? format(new Date(device.date_added), 'dd.MM.yyyy') : '-'}
                </TableCell>
                <TableCell>
                  {device.expiry_date 
                    ? format(new Date(device.expiry_date), 'dd.MM.yyyy')
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeviceClick(device);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Delete handler will be implemented later
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
