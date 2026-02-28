
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Device } from "@/types/device";
import { Zone, Door } from "@/hooks/useZonesAndDoors";
import { DeviceTableRow } from "@/components/devices/DeviceTableRow";
import { Loader2, Smartphone } from "lucide-react";
import { DeviceBulkActions } from "./DeviceBulkActions";
import { DeviceDeleteDialog } from "./DeviceDeleteDialog";
import { useDeviceTable } from "@/hooks/useDeviceTable";
import { Checkbox } from "@/components/ui/checkbox";

interface DeviceListProps {
  devices: Device[];
  filteredDevices: Device[];
  isLoading: boolean;
  zones: Zone[];
  doors: Door[];
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onQRClick?: (device: Device) => void;
}

export function DeviceList({
  devices,
  filteredDevices,
  isLoading,
  zones,
  doors,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onQRClick
}: DeviceListProps) {
  const {
    selectedDevices,
    showDeleteDialog,
    setShowDeleteDialog,
    handleSelectAll,
    handleSelectDevice,
    handleBulkDelete
  } = useDeviceTable(filteredDevices);

  function getZoneName(device: Device & { zone?: { name?: string }; zoneId?: string }) {
    const zoneId = device.zone_id || device.zoneId;
    if (device.zone?.name) return device.zone.name;
    if (!zoneId) return undefined;
    const zone = zones.find(z => String(z._id ?? (z as { id?: string }).id) === String(zoneId));
    return zone?.name;
  }

  function getDoorName(device: Device & { door?: { name?: string }; doorId?: string }) {
    const doorId = device.door_id || device.doorId;
    if (device.door?.name) return device.door.name;
    if (!doorId) return undefined;
    const door = doors.find(d => String(d._id ?? (d as { id?: string }).id) === String(doorId));
    return door?.name;
  }

  return (
    <div className="space-y-4">
      {selectedDevices.length > 0 && (
        <DeviceBulkActions
          selectedCount={selectedDevices.length}
          onDelete={() => setShowDeleteDialog(true)}
        />
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-white border-b-2 border-gray-200">
            <TableRow>
              <TableHead className="w-[50px] bg-gray-50 font-semibold">
                <Checkbox 
                  checked={filteredDevices.length > 0 && selectedDevices.length === filteredDevices.length} 
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="bg-gray-50 font-semibold">ID</TableHead>
              <TableHead className="bg-gray-50 font-semibold">Cihaz Seri No</TableHead>
              <TableHead className="bg-gray-50 font-semibold">Cihaz Modeli</TableHead>
              <TableHead className="bg-gray-50 font-semibold">Bölge</TableHead>
              <TableHead className="bg-gray-50 font-semibold">Kapı</TableHead>
              <TableHead className="bg-gray-50 font-semibold">Erişim Yönü</TableHead>
              <TableHead className="bg-gray-50 font-semibold">Durum</TableHead>
              <TableHead className="text-right bg-gray-50 font-semibold">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <span className="text-muted-foreground font-medium">Cihazlar yükleniyor...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDevices.length > 0 ? (
              filteredDevices.map((device, i) => (
                <DeviceTableRow
                  key={device.id || (device as { _id?: string })._id || `device-${i}`}
                  device={device}
                  zoneName={getZoneName(device)}
                  doorName={getDoorName(device)}
                  onDeleteDevice={onDeleteDevice}
                  onAssignLocation={onAssignLocation}
                  onEditDevice={onEditDevice}
                  onQRClick={onQRClick}
                  selected={selectedDevices.includes(device.id || (device as { _id?: string })._id || "")}
                  onSelect={handleSelectDevice}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Smartphone className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        {devices.length > 0 
                          ? "Filtrelere uygun cihaz bulunamadı" 
                          : "Henüz cihaz bulunmuyor"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {devices.length > 0 
                          ? "Lütfen filtrelerinizi değiştirip tekrar deneyin" 
                          : "Yeni cihaz eklemek için 'Yeni Cihaz Ekle' butonuna tıklayın"}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DeviceDeleteDialog 
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedDevices.length}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
