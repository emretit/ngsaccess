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
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);

  const { zones, doors } = useZonesAndDoors();
  const rawDevicesData = useQuery(api.devices.list) ?? [];

  const removeDevice = useMutation(api.devices.remove);

  const rawDevices: Device[] = rawDevicesData.map((device: {
    _id: Id<"devices">;
    name?: string;
    serialNumber?: string;
    deviceSerial?: string;
    deviceModel?: string;
    deviceType?: string;
    type?: string;
    status?: string;
    zoneId?: Id<"zones">;
    doorId?: Id<"doors">;
    accessDirection?: string;
    deviceMac?: string;
    deviceIp?: string;
    deviceFirmware?: string;
    _creationTime?: number;
    lastUsedAt?: string;
    deviceLocation?: string;
  }): Device => ({
    id: device._id,
    name: device.name ?? "",
    device_name: device.name,
    serial_number: device.serialNumber,
    device_serial: device.deviceSerial,
    device_model: device.deviceModel,
    device_type: device.deviceType,
    type: device.type,
    status: device.status === "active" ? "online" : "offline",
    zone_id: device.zoneId as unknown as number,
    door_id: device.doorId as unknown as number,
    access_direction: device.accessDirection,
    device_mac: device.deviceMac,
    device_ip: device.deviceIp,
    device_firmware: device.deviceFirmware,
    created_at: device._creationTime ? new Date(device._creationTime).toISOString() : undefined,
    last_used_at: device.lastUsedAt,
    device_location: device.deviceLocation,
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
      await removeDevice({ id: deviceId as Id<"devices"> });
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
        isLoading={rawDevicesData === undefined}
        zones={zones}
        doors={doors}
        onDeleteDevice={handleDeleteDevice}
        onAssignLocation={handleAssignLocation}
        onEditDevice={handleEditDevice}
      />
    </div>
  );
}
