
import { useState, useEffect } from 'react';
import { DevicesContent } from '@/components/devices/DevicesContent';
import { ZoneDoorTreePanel } from '@/components/access-control/ZoneDoorTreePanel';
import { DeviceForm } from '@/components/devices/DeviceForm';
import { QRCodeDialog } from '@/components/devices/QRCodeDialog';
import { DeviceDeleteDialog } from '@/components/devices/DeviceDeleteDialog';
import { AssignLocationForm } from '@/components/devices/AssignLocationForm';
import { DeviceDetailsPanel } from '@/components/devices/DeviceDetailsPanel';
import { useProjectFilteredDevices } from '@/hooks/useProjectFilteredDevices';
import { useZonesAndDoors } from '@/hooks/useZonesAndDoors';
import { useQRCodeDialog } from '@/components/devices/useQRCodeDialog';
import { useLocationForm } from '@/components/devices/useLocationForm';
import { useDeviceActions } from '@/components/devices/useDeviceActions';
import { useDeviceTable } from '@/hooks/useDeviceTable';
import { Device, ServerDevice } from '@/types/device';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AccessDenied } from '@/components/shared/AccessDenied';
import { useToast } from '@/hooks/use-toast';

const Devices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const { devices, isLoading, hasProjectAccess } = useProjectFilteredDevices();
  const { zones, doors } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  
  // Device panel state
  const [devicePanel, setDevicePanel] = useState<{
    open: boolean;
    device: ServerDevice | null;
  }>({
    open: false,
    device: null
  });
  
  const { toast } = useToast();
  
  // QR Dialog
  const { selectedQR, handleQRClick, handleDownloadQR, closeQRDialog } = useQRCodeDialog();
  
  // Location form
  const { showLocationForm, openLocationForm, closeLocationForm, handleAssignLocation } = useLocationForm();
  
  // Device actions
  const { handleDeleteDevice } = useDeviceActions();
  
  // Device table selection
  const { showDeleteDialog, setShowDeleteDialog, handleBulkDelete } = useDeviceTable(devices);

  // Clear selections when zone/door changes
  useEffect(() => {
    if (selectedZoneId) {
      setSelectedDoorId(null);
    }
  }, [selectedZoneId]);

  const handleNewDevice = () => {
    setDevicePanel({
      open: true,
      device: null
    });
  };

  const handleEditDevice = (device: Device) => {
    // Convert to ServerDevice format for the form (Convex uses _id, zoneId, doorId)
    const serverDevice: ServerDevice = {
      id: device.id || (device as { _id?: string })._id || '',
      name: device.name || device.device_name || '',
      serial_number: device.serial_number || device.device_serial || '',
      device_model_enum: "Other",
      date_added: device.created_at || new Date().toISOString(),
      status: device.status || 'online',
      zone_id: (device as { zoneId?: string }).zoneId ?? device.zone_id,
      door_id: (device as { doorId?: string }).doorId ?? device.door_id
    };
    
    setDevicePanel({
      open: true,
      device: serverDevice
    });
  };

  const handleDevicePanelClose = () => {
    setDevicePanel({ open: false, device: null });
  };

  const handleDevicePanelSuccess = () => {
    setDevicePanel({ open: false, device: null });
    toast({
      title: "İşlem başarılı",
      description: "Cihaz bilgileri kaydedildi",
    });
  };

  // Loading durumunda (hem project hem devices loading) loading göster
  if (projectLoading || isLoading) {
    return <LoadingSpinner text="Cihazlar yükleniyor..." />;
  }

  // Proje erişimi yoksa ve loading de tamamlandıysa mesaj göster
  if (!projectLoading && !isLoading && !hasProjectAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="flex gap-4 min-h-full">
      <ZoneDoorTreePanel
          onSelectZone={setSelectedZoneId}
          onSelectDoor={setSelectedDoorId}
        />

      <div className="flex-1 min-w-0 space-y-3">
        <DevicesContent
          devices={devices}
          isLoading={isLoading}
          zones={zones}
          doors={doors}
          selectedZoneId={selectedZoneId}
          selectedDoorId={selectedDoorId}
          onDeleteDevice={handleDeleteDevice}
          onAssignLocation={openLocationForm}
          onEditDevice={handleEditDevice}
          onNewDevice={handleNewDevice}
          onQRClick={handleQRClick}
        />
      </div>

      {/* Device Details Panel */}
      <DeviceDetailsPanel
        open={devicePanel.open}
        onClose={handleDevicePanelClose}
        selectedDevice={devicePanel.device}
        onSuccess={handleDevicePanelSuccess}
      />

      {/* QR Code Dialog */}
      <QRCodeDialog
        open={!!selectedQR}
        onOpenChange={(open) => !open && closeQRDialog()}
        qrData={selectedQR}
        onDownload={handleDownloadQR}
      />

      {/* Delete Dialog */}
      <DeviceDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={0}
        onConfirm={handleBulkDelete}
      />

      {/* Location Assignment Form */}
      <AssignLocationForm
        open={showLocationForm.open}
        onClose={closeLocationForm}
        onSubmit={handleAssignLocation}
        deviceName={showLocationForm.device?.name || showLocationForm.device?.device_name || 'Unknown Device'}
        device={showLocationForm.device ? {
          ...showLocationForm.device,
          name: showLocationForm.device.name || showLocationForm.device.device_name || 'Unknown Device',
          serial_number: showLocationForm.device.serial_number || showLocationForm.device.device_serial || '',
          device_model_enum: "Other" as const,
          date_added: new Date().toISOString()
        } : undefined}
      />
    </div>
  );
};

export default Devices;
