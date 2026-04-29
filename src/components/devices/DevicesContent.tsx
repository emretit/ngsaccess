// @ts-nocheck

import { Device, ServerDevice } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { DeviceStats } from "@/components/devices/DeviceStats";
import { Zone, Door } from "@/hooks/useZonesAndDoors";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";

interface DevicesContentProps {
  devices: Device[];
  isLoading: boolean;
  zones: Zone[];
  doors: Door[];
  selectedZoneId: number | null;
  selectedDoorId: number | null;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onNewDevice: () => void;
  onQRClick?: (device: Device) => void;
}

export function DevicesContent({
  devices,
  isLoading,
  zones,
  doors,
  selectedZoneId,
  selectedDoorId,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onNewDevice,
  onQRClick
}: DevicesContentProps) {
  // Use the extracted filter hook
  const {
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
    <div className="space-y-3">
      <DeviceFilters 
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        deviceTypes={deviceTypes}
        onNewDevice={onNewDevice}
        deviceCount={devices.length}
        filteredCount={filteredDevices.length}
      />

      <DeviceStats devices={filteredDevices} />

      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <DeviceList 
          devices={devices}
          filteredDevices={filteredDevices}
          isLoading={isLoading}
          zones={zones}
          doors={doors}
          onDeleteDevice={onDeleteDevice}
          onAssignLocation={onAssignLocation}
          onEditDevice={onEditDevice}
          onQRClick={onQRClick}
        />
      </div>
    </div>
  );
}
