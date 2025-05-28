
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

  const { qrDevice, isQROpen, openQRDialog, closeQRDialog } = useQRCodeDialog();
  const { handleDeleteDevice, handleAssignLocation, handleEditDevice } = useDeviceActions({
    onRefresh: refetch,
    onEditDevice: (device) => {
      setSelectedDevice(device);
      setIsPanelOpen(true);
    },
    onDeleteDevice: (device) => {
      setDeviceToDelete(device);
      setIsDeleteDialogOpen(true);
    },
    onAssignLocation: (device) => {
      setSelectedDevice(device);
      setIsAssignLocationOpen(true);
    }
  });

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
            onQRClick={openQRDialog}
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
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        device={selectedDevice}
        onSave={() => {
          refetch();
          setIsPanelOpen(false);
        }}
      />

      <QRCodeDialog
        device={qrDevice}
        isOpen={isQROpen}
        onClose={closeQRDialog}
      />

      <DeviceDeleteDialog
        device={deviceToDelete}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
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
          if (selectedDevice) {
            await handleAssignLocation(selectedDevice);
            setIsAssignLocationOpen(false);
          }
        }}
      />

      <DeviceForm
        device={null}
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
