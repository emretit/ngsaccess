
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DevicesContent } from "@/components/devices/DevicesContent";
import { DeviceDetailsPanel } from "@/components/devices/DeviceDetailsPanel";
import { QRCodeDialog } from "@/components/devices/QRCodeDialog";
import { DeviceDeleteDialog } from "@/components/devices/DeviceDeleteDialog";
import { AssignLocationForm } from "@/components/devices/AssignLocationForm";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { ZoneDoorTreePanel } from "@/components/access-control/ZoneDoorTreePanel";
import { useProjectFilteredDevices } from "@/hooks/useProjectFilteredDevices";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { useDeviceActions } from "@/components/devices/useDeviceActions";
import { useQRCodeDialog } from "@/components/devices/useQRCodeDialog";
import { Device } from "@/types/device";

export default function Devices() {
  const { devices, isLoading, refetch, hasProjectAccess } = useProjectFilteredDevices();
  const { zones, doors } = useZonesAndDoors();
  
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignLocationOpen, setIsAssignLocationOpen] = useState(false);
  const [isNewDeviceOpen, setIsNewDeviceOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);

  const { selectedQR, handleQRClick, handleDownloadQR, closeQRDialog } = useQRCodeDialog();
  const { handleDeleteDevice } = useDeviceActions();

  if (!hasProjectAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Proje Erişimi Yok</h3>
            <p className="text-gray-600 mt-2">
              Bu sayfaya erişim için size atanmış bir proje bulunmuyor. 
              Lütfen sistem yöneticinizle iletişime geçin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6 p-6">
      {/* Left sidebar with zone/door tree */}
      <ZoneDoorTreePanel 
        onSelectZone={setSelectedZoneId}
        onSelectDoor={setSelectedDoorId}
      />

      {/* Main content area */}
      <Card className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <DevicesContent
            devices={devices}
            isLoading={isLoading}
            zones={zones}
            doors={doors}
            selectedZoneId={selectedZoneId}
            selectedDoorId={selectedDoorId}
            onQRClick={handleQRClick}
            onDeleteDevice={(deviceId) => {
              const device = devices.find(d => d.id.toString() === deviceId);
              if (device) {
                setDeviceToDelete(device);
                setIsDeleteDialogOpen(true);
              }
            }}
            onAssignLocation={(device) => {
              setSelectedDevice(device);
              setIsAssignLocationOpen(true);
            }}
            onEditDevice={(device) => {
              setSelectedDevice(device);
              setIsPanelOpen(true);
            }}
            onNewDevice={() => {
              setSelectedDevice(null);
              setIsNewDeviceOpen(true);
            }}
          />
        </div>
      </Card>

      <DeviceDetailsPanel
        open={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        selectedDevice={selectedDevice ? {
          id: selectedDevice.id,
          name: selectedDevice.device_name || selectedDevice.name || '',
          serial_number: selectedDevice.device_serial || selectedDevice.serial_number || '',
          device_model_enum: "Other" as const,
          date_added: selectedDevice.created_at || new Date().toISOString(),
          status: selectedDevice.status,
          zone_id: selectedDevice.zone_id,
          door_id: selectedDevice.door_id
        } : null}
        onSuccess={() => {
          refetch();
          setIsPanelOpen(false);
        }}
      />

      <QRCodeDialog
        open={!!selectedQR}
        onOpenChange={closeQRDialog}
        qrData={selectedQR}
        onDownload={handleDownloadQR}
      />

      <DeviceDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        selectedCount={1}
        onConfirm={async () => {
          if (deviceToDelete) {
            await handleDeleteDevice(deviceToDelete.id.toString());
            setIsDeleteDialogOpen(false);
            setDeviceToDelete(null);
          }
        }}
      />

      <AssignLocationForm
        open={isAssignLocationOpen}
        onClose={() => setIsAssignLocationOpen(false)}
        onSubmit={async (zoneId: number, doorId: number) => {
          // TODO: Implement location assignment logic
          console.log('Assigning location:', { zoneId, doorId });
        }}
        deviceName={selectedDevice?.device_name || selectedDevice?.name || ''}
        device={selectedDevice ? {
          id: selectedDevice.id,
          name: selectedDevice.device_name || selectedDevice.name || '',
          serial_number: selectedDevice.device_serial || selectedDevice.serial_number || '',
          device_model_enum: "Other" as const,
          date_added: selectedDevice.created_at || new Date().toISOString(),
          status: selectedDevice.status,
          zone_id: selectedDevice.zone_id,
          door_id: selectedDevice.door_id
        } : undefined}
      />

      <DeviceForm
        onAddDevice={() => {}}
        isLoading={false}
        onOpenDevicePanel={() => {
          setSelectedDevice(null);
          setIsNewDeviceOpen(true);
        }}
      />
    </div>
  );
}
