import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Device } from "@/types/device";
import { DeviceList } from "@/components/devices/DeviceList";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { AdminDeviceDialog } from "@/components/admin/AdminDeviceDialog";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { toast } from "@/hooks/use-toast";
import { computeDeviceStatus } from "@/lib/deviceStatus";

export function AdminDevicesPanel() {
  const [selectedZoneId, _setSelectedZoneId] = useState<string | null>(null);
  const [selectedDoorId, _setSelectedDoorId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  const { zones, doors } = useZonesAndDoors();
  const rawDevicesData = useQuery(api.devices.list);
  const projectsData = useQuery(api.projects.list);
  const projectNameById = new Map(
    (projectsData ?? []).map((p) => [String(p._id), p.name])
  );
  const isLoading = rawDevicesData === undefined;

  const removeDevice = useMutation(api.devices.remove);

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const rawDevices: Device[] = (rawDevicesData ?? []).map((device: Device & { _creationTime?: number }) => ({
    ...device,
    // Online/offline lastSeen'den hesaplanır (Cihazlar sayfasıyla aynı util) — havuzdaki
    // atanmamış cihazlar da panel bağlanınca canlı görünür.
    status: computeDeviceStatus(device.lastSeen, nowMs),
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

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setDialogOpen(true);
  };

  const handleNewDevice = () => {
    setEditingDevice(null);
    setDialogOpen(true);
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
        onEditDevice={handleEditDevice}
        showProject
        hideLocation
        getProjectName={(d) => (d.projectId ? projectNameById.get(String(d.projectId)) : "Havuzda (atanmamış)")}
      />

      <AdminDeviceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        device={editingDevice}
        onSuccess={() => setDialogOpen(false)}
      />
    </div>
  );
}
