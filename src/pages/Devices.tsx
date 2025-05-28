
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DevicesContent } from "@/components/devices/DevicesContent";
import { DeviceDetailsPanel } from "@/components/devices/DeviceDetailsPanel";
import { QRCodeDialog } from "@/components/devices/QRCodeDialog";
import { DeviceDeleteDialog } from "@/components/devices/DeviceDeleteDialog";
import { AssignLocationForm } from "@/components/devices/AssignLocationForm";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { useProjectFilteredDevices } from "@/hooks/useProjectFilteredDevices";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
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
  const [isQROpen, setIsQROpen] = useState(false);
  const [qrDevice, setQrDevice] = useState<Device | null>(null);

  const handleQRClick = (device: Device) => {
    setQrDevice(device);
    setIsQROpen(true);
  };

  const closeQRDialog = () => {
    setIsQROpen(false);
    setQrDevice(null);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    // Delete implementation would go here
    console.log('Delete device:', deviceId);
    refetch();
  };

  const handleAssignLocation = (device: Device) => {
    setSelectedDevice(device);
    setIsAssignLocationOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setSelectedDevice(device);
    setIsPanelOpen(true);
  };

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
    <div className="flex h-[calc(100vh-4rem)]">
      <Card className="flex-1 m-6 overflow-hidden">
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
            onAssignLocation={handleAssignLocation}
            onEditDevice={handleEditDevice}
            onNewDevice={() => {
              setSelectedDevice(null);
              setIsNewDeviceOpen(true);
            }}
          />
        </div>
      </Card>

      <DeviceDetailsPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        device={selectedDevice}
        onSave={() => {
          refetch();
          setIsPanelOpen(false);
        }}
      />

      <QRCodeDialog
        isOpen={isQROpen}
        onClose={closeQRDialog}
        deviceName={qrDevice?.name || ''}
        serialNumber={qrDevice?.device_serial || ''}
      />

      <DeviceDeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        deviceName={deviceToDelete?.name || ''}
        onConfirm={async () => {
          if (deviceToDelete) {
            await handleDeleteDevice(deviceToDelete.id.toString());
            setIsDeleteDialogOpen(false);
            setDeviceToDelete(null);
          }
        }}
      />

      <AssignLocationForm
        device={selectedDevice}
        isOpen={isAssignLocationOpen}
        onClose={() => setIsAssignLocationOpen(false)}
        onSave={async () => {
          refetch();
          setIsAssignLocationOpen(false);
        }}
      />

      <DeviceForm
        isOpen={isNewDeviceOpen}
        onClose={() => setIsNewDeviceOpen(false)}
        onSave={() => {
          refetch();
          setIsNewDeviceOpen(false);
        }}
      />
    </div>
  );
}
