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
}

export function DeviceList({
  devices,
  filteredDevices,
  isLoading,
  zones,
  doors,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice
}: DeviceListProps) {
  const {
    selectedDevices,
    showDeleteDialog,
    setShowDeleteDialog,
    handleSelectAll,
    handleSelectDevice,
    handleBulkDelete
  } = useDeviceTable(filteredDevices);

  function getZoneName(device: Device) {
    const zone = zones.find(z => String(z.id) === String(device.zone_id));
    return zone?.name;
  }

  function getDoorName(device: Device) {
    const door = doors.find(d => String(d.id) === String(device.door_id));
    return door?.name;
  }

  return (
    <div className="h-full flex flex-col">
      {selectedDevices.length > 0 && (
        <div className="p-4 border-b border-gray-100 bg-blue-50">
          <DeviceBulkActions
            selectedCount={selectedDevices.length}
            onDelete={() => setShowDeleteDialog(true)}
          />
        </div>
      )}
      
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white border-b-2 border-gray-200">
            <TableRow>
              <TableHead className="w-[50px] bg-gray-50">
                <Checkbox 
                  checked={filteredDevices.length > 0 && selectedDevices.length === filteredDevices.length} 
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="bg-gray-50 font-semibold">ID</TableHead>
              <TableHead className="bg-gray-50 font-semibold">İsim</TableHead>
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
              filteredDevices.map((device) => (
                <DeviceTableRow
                  key={device.id}
                  device={device}
                  zoneName={getZoneName(device)}
                  doorName={getDoorName(device)}
                  onDeleteDevice={onDeleteDevice}
                  onAssignLocation={onAssignLocation}
                  onEditDevice={onEditDevice}
                  selected={selectedDevices.includes(device.id)}
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
