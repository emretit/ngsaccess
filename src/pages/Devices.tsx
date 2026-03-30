
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
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  
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
  const { showDeleteDialog, setShowDeleteDialog, handleBulkDelete } = useDeviceTable(devices as any);

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
    const dev = device as Record<string, unknown>;
    const serverDevice: ServerDevice = {
      id: String(dev._id || dev.id || ''),
      name: String(dev.name || dev.device_name || ''),
      serial_number: String(dev.deviceSerial || dev.device_serial || dev.serial_number || ''),
      device_model_enum: "Other",
      date_added: String(dev.createdAt || dev.created_at || new Date().toISOString()),
      status: (dev.status as ServerDevice["status"]) || 'active',
      zone_id: String(dev.zoneId || dev.zone_id || ''),
      door_id: String(dev.doorId || dev.door_id || ''),
      device_ip: String(dev.deviceIp || dev.device_ip || ''),
      device_type: String(dev.deviceType || dev.device_type || ''),
      description: String(dev.description || ''),
      access_direction: (dev.accessDirection || dev.access_direction || 'both') as ServerDevice["access_direction"],
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
          devices={devices as any}
          isLoading={isLoading}
          zones={zones}
          doors={doors}
          selectedZoneId={selectedZoneId as any}
          selectedDoorId={selectedDoorId as any}
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
