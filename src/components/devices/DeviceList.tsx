
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Device } from "@/types/device";
import { Zone } from "@/hooks/useZonesAndDoors";
import { DeviceTableRow } from "@/components/devices/DeviceTableRow";
import { Smartphone } from "lucide-react";
import { DeviceBulkActions } from "./DeviceBulkActions";
import { DeviceDeleteDialog } from "./DeviceDeleteDialog";
import { useDeviceTable } from "@/hooks/useDeviceTable";
import { Checkbox } from "@/components/ui/checkbox";

import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";

interface DeviceListProps {
  onClearFilters?: () => void;
  onAddDevice?: () => void;
  devices: Device[];
  filteredDevices: Device[];
  isLoading: boolean;
  zones: Zone[];
  onDeleteDevice: (deviceId: string) => Promise<void> | void;
  onAssignLocation?: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onQRClick?: (device: Device) => void;
  onReleaseDevice?: (device: Device) => void;
  /** Admin görünümü: cihazın bağlı olduğu proje kolonunu göster. */
  showProject?: boolean;
  /** Admin görünümü: bölge kolonunu ve "Konum Ata" aksiyonunu gizler. */
  hideLocation?: boolean;
  getProjectName?: (device: Device) => string | undefined;
}

export function DeviceList({
  onClearFilters,
  onAddDevice,
  devices,
  filteredDevices,
  isLoading,
  zones,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onQRClick,
  onReleaseDevice,
  showProject,
  hideLocation,
  getProjectName
}: DeviceListProps) {
  const {
    selectedDevices,
    showDeleteDialog,
    setShowDeleteDialog,
    handleSelectAll,
    handleSelectDevice,
    handleBulkDelete
  } = useDeviceTable(filteredDevices);

  function getZoneName(device: Device & { zone?: { name?: string } | null }) {
    const zoneId = device.zoneId;
    if (device.zone?.name) return device.zone.name;
    if (!zoneId) return undefined;
    const zone = zones.find(z => String(z._id) === String(zoneId));
    return zone?.name;
  }

  // Sabit kolonlar: seçim + # + Cihaz Adı + Seri No + Cihaz Modeli + Durum + İşlemler = 7.
  const colCount = 7 + (showProject ? 1 : 0) + (hideLocation ? 0 : 1);

  return (
    <div className="space-y-4">
      {selectedDevices.length > 0 && (
        <DeviceBulkActions
          selectedCount={selectedDevices.length}
          onDelete={() => setShowDeleteDialog(true)}
        />
      )}
      
      <div role="region" aria-label="Cihaz listesi, yatay kaydırılabilir" tabIndex={0} className="max-w-full rounded-md border overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Table className="min-w-[760px]">
          <TableHeader className="sticky top-0 bg-card border-b-2 border-border">
            <TableRow>
              <TableHead className="w-[50px] bg-muted/50 font-semibold">
                <Checkbox
                  aria-label="Görünen tüm cihazları seç"
                  checked={filteredDevices.length > 0 && filteredDevices.every((device) => selectedDevices.includes(device._id))}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="bg-muted/50 font-semibold">#</TableHead>
              {showProject && <TableHead className="bg-muted/50 font-semibold">Proje</TableHead>}
              <TableHead className="bg-muted/50 font-semibold">Cihaz Adı</TableHead>
              <TableHead className="bg-muted/50 font-semibold">Seri No / UUID</TableHead>
              <TableHead className="bg-muted/50 font-semibold">Cihaz Modeli</TableHead>
              {!hideLocation && (
                <>
                  <TableHead className="bg-muted/50 font-semibold">Bölge</TableHead>
                </>
              )}
              <TableHead className="bg-muted/50 font-semibold">Durum</TableHead>
              <TableHead className="text-right bg-muted/50 font-semibold">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-16">
                  <SectionSkeleton rows={4} label="Cihazlar yükleniyor" />
                </TableCell>
              </TableRow>
            ) : filteredDevices.length > 0 ? (
              filteredDevices.map((device, i) => (
                <DeviceTableRow
                  key={String(device._id) || `device-${i}`}
                  device={device}
                  rowIndex={i + 1}
                  zoneName={getZoneName(device)}
                  showProject={showProject}
                  hideLocation={hideLocation}
                  projectName={getProjectName?.(device)}
                  onDeleteDevice={onDeleteDevice}
                  onAssignLocation={onAssignLocation}
                  onEditDevice={onEditDevice}
                  onQRClick={onQRClick}
                  onReleaseDevice={onReleaseDevice}
                  selected={selectedDevices.includes(device._id)}
                  onSelect={handleSelectDevice}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-16">
                  <EmptyState icon={Smartphone}
                    title={devices.length ? "Filtrelere uygun cihaz bulunamadı" : "Henüz cihaz bulunmuyor"}
                    description={devices.length ? "Etkin filtreleri temizleyerek tüm cihazları görüntüleyin." : "Bu projeye henüz cihaz eklenmemiş."}
                    action={devices.length && onClearFilters ? { label: "Filtreleri temizle", onClick: onClearFilters } : onAddDevice ? { label: "Cihaz ekle", onClick: onAddDevice } : undefined} />
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
        deviceNames={devices.filter((device) => selectedDevices.includes(device._id)).map((device) => device.name ?? device.deviceSerial ?? "Adsız cihaz")}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
