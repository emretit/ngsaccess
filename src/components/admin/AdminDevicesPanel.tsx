import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Device } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";

export function AdminDevicesPanel() {
  const [selectedZoneId, _setSelectedZoneId] = useState<string | null>(null);
  const [selectedDoorId, _setSelectedDoorId] = useState<string | null>(null);

  const { zones, doors } = useZonesAndDoors();
  const rawDevicesData = useQuery(api.devices.list);
  const isLoading = rawDevicesData === undefined;

  const removeDevice = useMutation(api.devices.remove);

  const rawDevices: Device[] = (rawDevicesData ?? []).map((device: Device & { _creationTime?: number }) => ({
    ...device,
    status: device.status === "active" ? "online" : (device.status ?? "offline"),
    createdAt: device.createdAt ?? (device._creationTime ? new Date(device._creationTime).toISOString() : undefined),
  }));

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    deviceTypes,
    filteredDevices,
  } = useDeviceFilters(rawDevices, selectedZoneId, selectedDoorId);

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await removeDevice({ deviceId: deviceId as Id<"devices"> });
    } catch (error) {
      console.error("Error deleting device:", error);
    }
  };

  const handleAssignLocation = (device: Device) => {
    console.log("Assign location for device:", device);
  };

  const handleEditDevice = (device: Device) => {
    console.log("Edit device:", device);
  };

  const handleNewDevice = () => {
    console.log("Add new device");
  };

  return (
    <div className="space-y-6">
      <DeviceFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        deviceTypes={deviceTypes}
        onNewDevice={handleNewDevice}
        deviceCount={rawDevices.length}
        filteredCount={filteredDevices.length}
      />
      <DeviceList
        devices={rawDevices}
        filteredDevices={filteredDevices}
        isLoading={isLoading}
        zones={zones}
        doors={doors}
        onDeleteDevice={handleDeleteDevice}
        onAssignLocation={handleAssignLocation}
        onEditDevice={handleEditDevice}
      />
    </div>
  );
}
