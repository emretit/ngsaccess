import { useState } from "react";

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
import { ListSelectAll } from "@/components/shared/ListSelectAll";

import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";

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
  /** Bölge/kapı filtresi aktifken sütun her satırda aynı değeri tekrarlar; gizlenir. */
  hideZoneColumn?: boolean;
  canManage?: boolean;
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
  hideZoneColumn,
  canManage = false,
  getProjectName,
}: DeviceListProps) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(filteredDevices.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageDevices = filteredDevices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const {
    selectedDevices,
    checked,
    showDeleteDialog,
    setShowDeleteDialog,
    handleSelectAll,
    handleSelectDevice,
    handleBulkDelete,
  } = useDeviceTable(pageDevices);

  function getZoneName(device: Device & { zone?: { name?: string } | null }) {
    const zoneId = device.zoneId;
    if (device.zone?.name) return device.zone.name;
    if (!zoneId) return undefined;
    const zone = zones.find((z) => String(z._id) === String(zoneId));
    return zone?.name;
  }

  // Seçim, ad, model, seri, bağlantı ve işlemler; proje ve konum isteğe bağlı.
  const colCount =
    6 + (showProject ? 1 : 0) + (hideLocation || hideZoneColumn ? 0 : 1);

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface">
      <div className="h-[88px] overflow-auto border-b border-line sm:h-[53px]">
        {canManage && selectedDevices.length > 0 ? (
          <DeviceBulkActions
            selectedCount={selectedDevices.length}
            onDelete={() => setShowDeleteDialog(true)}
            onClear={() => handleSelectAll(false)}
          />
        ) : (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {canManage
              ? "Cihaz seçerek toplu işlem yapabilirsiniz."
              : "Cihaz ayrıntılarını satır menüsünden görüntüleyebilirsiniz."}
          </p>
        )}
      </div>

      <div
        role="region"
        aria-label="Cihaz listesi, yatay kaydırılabilir"
        tabIndex={0}
        className="min-w-0 max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Table density="compact" className="w-full table-fixed">
          <TableHeader className="bg-subtle">
            <TableRow>
              <TableHead className="w-9 px-2 md:w-10 md:px-3">
                <ListSelectAll
                  label="Görünen tüm cihazları seç"
                  checked={checked}
                  onChange={handleSelectAll}
                />
              </TableHead>
              {showProject && (
                <TableHead className="hidden lg:table-cell">Proje</TableHead>
              )}
              <TableHead className="px-2 md:px-4">Cihaz adı</TableHead>
              <TableHead className="hidden md:table-cell w-[180px]">
                Marka / model
              </TableHead>
              <TableHead className="hidden xl:table-cell w-[170px]">
                Seri no / UUID
              </TableHead>
              {!(hideLocation || hideZoneColumn) && (
                <TableHead className="hidden lg:table-cell w-[140px]">
                  Bölge
                </TableHead>
              )}
              <TableHead className="w-[112px] px-1 md:w-[132px] md:px-3">
                Bağlantı
              </TableHead>
              <TableHead className="w-11 px-0 md:px-1">
                <span className="sr-only">İşlemler</span>
              </TableHead>
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
                  canManage={canManage}
                  device={device}
                  rowIndex={i + 1}
                  zoneName={getZoneName(device)}
                  showProject={showProject}
                  hideLocation={hideLocation}
                  hideZoneColumn={hideZoneColumn}
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
                  <EmptyState
                    icon={Smartphone}
                    title={
                      devices.length
                        ? "Filtrelere uygun cihaz bulunamadı"
                        : "Bu projede henüz cihaz yok"
                    }
                    description={
                      devices.length
                        ? "Etkin filtreleri temizleyerek tüm cihazları görüntüleyin."
                        : "Bu projeye henüz cihaz eklenmemiş."
                    }
                    action={
                      devices.length && onClearFilters
                        ? {
                            label: "Filtreleri temizle",
                            onClick: onClearFilters,
                          }
                        : onAddDevice
                          ? { label: "Cihaz ekle", onClick: onAddDevice }
                          : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        summary={
          <>
            {devices.length} cihazdan {filteredDevices.length} sonuç
            {filteredDevices.length > 0 && (
              <>
                {" "}
                · {pageRange(
                  filteredDevices.length,
                  currentPage,
                  pageSize,
                )}{" "}
                gösteriliyor
              </>
            )}
          </>
        }
        page={currentPage}
        pageCount={pageCount}
        onPrevious={() => setPage(currentPage - 1)}
        onNext={() => setPage(currentPage + 1)}
        pageSize={pageSize}
        pageSizes={[25, 50, 100]}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeLabel="Sayfadaki cihaz sayısı"
      />
      <DeviceDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedDevices.length}
        deviceNames={devices
          .filter((device) => selectedDevices.includes(device._id))
          .map((device) => device.name ?? device.deviceSerial ?? "Adsız cihaz")}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
