import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DeviceAddMenu } from "./DeviceAddMenu";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Device } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { Zone } from "@/hooks/useZonesAndDoors";
import { deviceMatchesFilters } from "@/lib/deviceDisplay";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";

interface DevicesContentProps {
  /** Sol filtre paneli (Bölge → Kapı). */
  sidebar?: ReactNode;
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
  /** Sanal okuyucu (tablet kamerasıyla QR) ekleme akışı. */
  onAddVirtualReader?: () => void;
  onQRClick?: (device: Device) => void;
  onReleaseDevice?: (device: Device) => Promise<void> | void;
  /** Yönetimsel aksiyonlar (cihaz ekle menüsü) yalnız admin'e gösterilir. */
  canManage?: boolean;
}

export function DevicesContent({
  devices,
  sidebar,
  isLoading,
  zones,
  selectedZoneId,
  selectedDoorId,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onAddNew,
  onAddFromCloud,
  onAddVirtualReader,
  onQRClick,
  onReleaseDevice,
  canManage = true,
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
    filteredDevices,
  } = useDeviceFilters(devices, selectedZoneId, selectedDoorId);

  const locationDevices = devices.filter((device) =>
    deviceMatchesFilters(device, {
      search: "",
      status: "all",
      type: "all",
      zoneId: selectedZoneId,
      doorId: selectedDoorId,
    }),
  );

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader title="Cihazlar">
        {canManage && (
          <DeviceAddMenu onAddNew={onAddNew} onAddFromCloud={onAddFromCloud} onAddVirtualReader={onAddVirtualReader} />
        )}
      </PageHeader>
      <div className="flex min-w-0 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:gap-5">
        {sidebar}
        <div className="min-w-0 flex-1 space-y-4">
          <DeviceFilters
            onClearFilters={clearFilters}
            locationActive={Boolean(selectedZoneId || selectedDoorId)}
            statusCounts={{
              all: locationDevices.length,
              online: locationDevices.filter(
                (d) => d.connectionStatus === "online",
              ).length,
              offline: locationDevices.filter(
                (d) => d.connectionStatus === "offline",
              ).length,
              never: locationDevices.filter(
                (d) => d.connectionStatus === "never",
              ).length,
            }}
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
              canManage={canManage}
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
              hideZoneColumn={Boolean(selectedZoneId || selectedDoorId)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
