import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  filterKey?: string;
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
  filterKey = "",
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
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) { setPreviousFilterKey(filterKey); setPage(1); }
  const pageCount = Math.max(1, Math.ceil(filteredDevices.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageDevices = filteredDevices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const {
    selectedDevices,
    showDeleteDialog,
    setShowDeleteDialog,
    handleSelectAll,
    handleSelectDevice,
    handleBulkDelete
  } = useDeviceTable(pageDevices);

  function getZoneName(device: Device & { zone?: { name?: string } | null }) {
    const zoneId = device.zoneId;
    if (device.zone?.name) return device.zone.name;
    if (!zoneId) return undefined;
    const zone = zones.find(z => String(z._id) === String(zoneId));
    return zone?.name;
  }

  // Seçim, ad, model, seri, bağlantı ve işlemler; proje ve konum isteğe bağlı.
  const colCount = 6 + (showProject ? 1 : 0) + (hideLocation ? 0 : 1);

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface">
      {selectedDevices.length > 0 && (
        <DeviceBulkActions
          selectedCount={selectedDevices.length}
          onDelete={() => setShowDeleteDialog(true)}
          onClear={() => handleSelectAll(false)}
        />
      )}

      <div role="region" aria-label="Cihaz listesi, yatay kaydırılabilir" tabIndex={0} className="min-w-0 max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Table density="compact" className="w-full table-fixed">
          <TableHeader className="bg-subtle">
            <TableRow>
              <TableHead className="w-9 px-2 md:w-10 md:px-3">
                <Checkbox
                  aria-label="Görünen tüm cihazları seç"
                  checked={pageDevices.length > 0 && pageDevices.every(device => selectedDevices.includes(device._id)) ? true : selectedDevices.length > 0 ? "indeterminate" : false}
                  onCheckedChange={checked => handleSelectAll(checked === true)}
                />
              </TableHead>
              {showProject && <TableHead className="hidden lg:table-cell">Proje</TableHead>}
              <TableHead className="px-2 md:px-4">Cihaz adı</TableHead>
              <TableHead className="hidden md:table-cell w-[180px]">Marka / model</TableHead>
              <TableHead className="hidden xl:table-cell w-[170px]">Seri no / UUID</TableHead>
              {!hideLocation && <TableHead className="hidden lg:table-cell w-[140px]">Bölge</TableHead>}
              <TableHead className="w-[112px] px-1 md:w-[132px] md:px-3">Bağlantı</TableHead>
              <TableHead className="w-10 px-1 md:w-11"><span className="sr-only">İşlemler</span></TableHead>
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
              pageDevices.map((device, i) => (
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
                    title={devices.length ? "Filtrelere uygun cihaz bulunamadı" : "Bu projede henüz cihaz yok"}
                    description={devices.length ? "Etkin filtreleri temizleyerek tüm cihazları görüntüleyin." : "Bu projeye henüz cihaz eklenmemiş."}
                    action={devices.length && onClearFilters ? { label: "Filtreleri temizle", onClick: onClearFilters } : onAddDevice ? { label: "Cihaz ekle", onClick: onAddDevice } : undefined} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-muted-foreground">
        <span role="status">{devices.length} cihazdan {filteredDevices.length} sonuç · {filteredDevices.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredDevices.length)} gösteriliyor</span>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
            <SelectTrigger aria-label="Sayfadaki cihaz sayısı" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{[25, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size} / sayfa</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Önceki</Button>
          <span className="tabular-nums">{currentPage} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Sonraki</Button>
        </div>
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
