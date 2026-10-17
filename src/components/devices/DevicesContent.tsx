
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Device } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { DeviceStats } from "@/components/devices/DeviceStats";
import { Zone } from "@/hooks/useZonesAndDoors";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";

interface DevicesContentProps {
  devices: Device[];
  isLoading: boolean;
  zones: Zone[];
  selectedZoneId: string | null;
  selectedDoorId: string | null;
  onDeleteDevice: (deviceId: string) => Promise<void> | void;
  onAssignLocation: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  /** Sıfırdan yeni cihaz oluşturma akışı. */
  onAddNew: () => void;
  /** Buluttan (havuzdan) cihaz ekleme akışı. */
  onAddFromCloud: () => void;
  onQRClick?: (device: Device) => void;
  onReleaseDevice?: (device: Device) => Promise<void> | void;
  /** Yönetimsel aksiyonlar (cihaz ekle menüsü) yalnız admin'e gösterilir. */
  canManage?: boolean;
}

export function DevicesContent({
  devices,
  isLoading,
  zones,
  selectedZoneId,
  selectedDoorId,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onAddNew,
  onAddFromCloud,
  onQRClick,
  onReleaseDevice,
  canManage = true
}: DevicesContentProps) {
  // Use the extracted filter hook
  const {
    clearFilters,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    deviceTypes,
    filteredDevices
  } = useDeviceFilters(devices, selectedZoneId, selectedDoorId);

  return (
    <div className="min-w-0 space-y-3">
      <DeviceFilters 
        onClearFilters={clearFilters}
        locationLabel={selectedDoorId ? "Kapı filtresi etkin" : selectedZoneId ? `Bölge: ${zones.find(zone => zone._id === selectedZoneId)?.name ?? "Seçili bölge"}` : undefined}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        deviceTypes={deviceTypes}
        onAddNew={onAddNew}
        onAddFromCloud={onAddFromCloud}
        showNewDevice={canManage}
        deviceCount={devices.length}
        filteredCount={filteredDevices.length}
      />

      {isLoading ? <SectionSkeleton rows={2} label="Cihaz özeti yükleniyor" /> : <DeviceStats devices={filteredDevices} />}

      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <DeviceList 
          onClearFilters={clearFilters}
          onAddDevice={canManage ? onAddNew : undefined}
          devices={devices}
          filteredDevices={filteredDevices}
          isLoading={isLoading}
          zones={zones}
          onDeleteDevice={onDeleteDevice}
          onAssignLocation={onAssignLocation}
          onEditDevice={onEditDevice}
          onQRClick={onQRClick}
          onReleaseDevice={onReleaseDevice}
        />
      </div>
    </div>
  );
}
