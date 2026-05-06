import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Device } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { toast } from "@/hooks/use-toast";

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
      toast({ title: "Başarılı", description: "Cihaz silindi" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz silinemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    }
  };

  const handleAssignLocation = (_device: Device) => {
    // TODO: open assign-location dialog
  };

  const handleEditDevice = (_device: Device) => {
    // TODO: open edit-device dialog
  };

  const handleNewDevice = () => {
    // TODO: open new-device dialog
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
