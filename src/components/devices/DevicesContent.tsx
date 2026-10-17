
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { PageHeader } from "@/components/shared/PageHeader";
import { DeviceAddMenu } from "./DeviceAddMenu";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Device } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { DeviceStats } from "@/components/devices/DeviceStats";
import { Zone } from "@/hooks/useZonesAndDoors";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";

interface DevicesContentProps {
  onOpenLocation?: () => void;
  onClearLocation?: () => void;
  locationLabel?: string;
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
  onOpenLocation, onClearLocation, locationLabel,
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
  const { activeProject } = useActiveProject();
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
    <div className="min-w-0 space-y-5">
      <PageHeader title="Cihazlar" scope={`${activeProject?.name ?? "Proje"} · Cihaz envanteri`}>
        {canManage && <DeviceAddMenu onAddNew={onAddNew} onAddFromCloud={onAddFromCloud} />}
      </PageHeader>
      <DeviceStats devices={devices} loading={isLoading} />
      <QuerySectionBoundary resetKey={activeProject?._id ?? "none"}><DeviceSyncStatusBanner /></QuerySectionBoundary>
      <DeviceFilters
        onClearFilters={clearFilters}
        locationLabel={locationLabel}
        onOpenLocation={onOpenLocation}
        onClearLocation={onClearLocation}
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



      <div className="min-w-0">
        <DeviceList
          filterKey={`${activeProject?._id}:${search}:${statusFilter}:${typeFilter}:${selectedZoneId}:${selectedDoorId}`}
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
