
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
  onQRClick: (device: Device) => void;
  onDeleteDevice: (deviceId: string) => void;
  onAssignLocation: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onNewDevice: () => void;
}

export function DevicesContent({
  devices,
  isLoading,
  zones,
  doors,
  selectedZoneId,
  selectedDoorId,
  onQRClick,
  onDeleteDevice,
  onAssignLocation,
  onEditDevice,
  onNewDevice
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
    <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-100">
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
      </div>

      {/* Stats Section */}
      <div className="px-6 py-4 border-b border-gray-100">
        <DeviceStats devices={filteredDevices} />
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden">
        <DeviceList 
          devices={devices}
          filteredDevices={filteredDevices}
          isLoading={isLoading}
          zones={zones}
          doors={doors}
          onQRClick={onQRClick}
          onDeleteDevice={onDeleteDevice}
          onAssignLocation={onAssignLocation}
          onEditDevice={onEditDevice}
        />
      </div>
    </div>
  );
}
