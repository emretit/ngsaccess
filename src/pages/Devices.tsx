
import { useState } from "react";
import { useDevices } from "@/hooks/useDevices";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { QRCodeDialog } from "@/components/devices/QRCodeDialog";
import { AssignLocationForm } from "@/components/devices/AssignLocationForm";
import { DeviceDetailsPanel } from "@/components/devices/DeviceDetailsPanel";
import { DevicesHeader } from "@/components/devices/DevicesHeader";
import { DevicesContent } from "@/components/devices/DevicesContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ZoneDoorTreePanel } from "@/components/access-control/ZoneDoorTreePanel";
import { useQRCodeDialog } from "@/components/devices/useQRCodeDialog";
import { useLocationForm } from "@/components/devices/useLocationForm";
import { useDeviceActions } from "@/components/devices/useDeviceActions";
import { DevicePanelContainer } from "@/components/devices/DevicePanelContainer";

export default function Devices() {
  const { devices, isLoading, addDevice, isAddingDevice } = useDevices();
  const { zones, doors } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  
  // Use our extracted hooks
  const { selectedQR, handleQRClick, handleDownloadQR, closeQRDialog } = useQRCodeDialog();
  const { showLocationForm, openLocationForm, closeLocationForm, handleAssignLocation } = useLocationForm();
  const { handleDeleteDevice } = useDeviceActions();
  
  // Device panel state and handlers
  const { 
    devicePanel,
    openDevicePanel, 
    handleDevicePanelSuccess, 
    handleDeviceEditClick,
    closeDevicePanel
  } = DevicePanelContainer({ 
    onSuccess: () => {} // Empty callback since we handle success in the container
  });
  
  return (
    <main className="p-0">
      <div className="max-w-7xl mx-auto flex gap-6">
        <div className="w-64 lg:w-72 shrink-0">
          <Card className="h-full border-0 shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg font-semibold">Bölgeler ve Kapılar</CardTitle>
              <CardDescription>
                Cihazları filtrelemek için bölge veya kapı seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ZoneDoorTreePanel 
                onSelectZone={setSelectedZoneId} 
                onSelectDoor={setSelectedDoorId}
              />
            </CardContent>
          </Card>
        </div>
        
        <div className="flex-1 space-y-6">
          <DevicesHeader
            deviceCount={devices.length}
            filteredCount={devices.length}
            onAddDevice={addDevice}
            isAddingDevice={isAddingDevice}
            onOpenDevicePanel={() => openDevicePanel()}
          />

          <DevicesContent
            devices={devices}
            isLoading={isLoading}
            zones={zones}
            doors={doors}
            selectedZoneId={selectedZoneId}
            selectedDoorId={selectedDoorId}
            onQRClick={handleQRClick}
            onDeleteDevice={handleDeleteDevice}
            onAssignLocation={openLocationForm}
            onEditDevice={handleDeviceEditClick}
          />

          <QRCodeDialog 
            open={!!selectedQR}
            onOpenChange={closeQRDialog}
            qrData={selectedQR}
            onDownload={handleDownloadQR}
          />
          
          {showLocationForm.open && showLocationForm.device && (
            <AssignLocationForm
              open={showLocationForm.open}
              onClose={closeLocationForm}
              deviceName={showLocationForm.device?.device_name || showLocationForm.device?.name || 'Cihaz'}
              onSubmit={handleAssignLocation}
              device={{
                id: showLocationForm.device.id,
                name: showLocationForm.device.name || '',
                serial_number: showLocationForm.device.serial_number || '',
                device_model_enum: "Other",
                zone_id: showLocationForm.device.zone_id,
                door_id: showLocationForm.device.door_id,
                date_added: new Date().toISOString(),
                status: 'online'
              }}
            />
          )}
          
          <DeviceDetailsPanel 
            open={devicePanel.open}
            onClose={closeDevicePanel}
            selectedDevice={devicePanel.device}
            onSuccess={handleDevicePanelSuccess}
          />
        </div>
      </div>
    </main>
  );
}
