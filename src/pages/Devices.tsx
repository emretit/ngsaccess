
import { useState, useEffect } from 'react';
import { DevicesContent } from '@/components/devices/DevicesContent';
import { ZoneDoorTreePanel } from '@/components/access-control/ZoneDoorTreePanel';
import { DeviceForm } from '@/components/devices/DeviceForm';
import { QRCodeDialog } from '@/components/devices/QRCodeDialog';
import { DeviceDeleteDialog } from '@/components/devices/DeviceDeleteDialog';
import { AssignLocationForm } from '@/components/devices/AssignLocationForm';
import { useProjectFilteredDevices } from '@/hooks/useProjectFilteredDevices';
import { useZonesAndDoors } from '@/hooks/useZonesAndDoors';
import { useQRCodeDialog } from '@/components/devices/useQRCodeDialog';
import { useLocationForm } from '@/components/devices/useLocationForm';
import { useDeviceActions } from '@/components/devices/useDeviceActions';
import { useDeviceTable } from '@/hooks/useDeviceTable';
import { Device } from '@/types/device';
import ProjectFilter from '@/components/auth/ProjectFilter';

const Devices = () => {
  const { devices, isLoading, hasProjectAccess } = useProjectFilteredDevices();
  const { zones, doors } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  
  // Device form state
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  
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
    setEditingDevice(null);
    setShowDeviceForm(true);
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setShowDeviceForm(true);
  };

  const closeDeviceForm = () => {
    setShowDeviceForm(false);
    setEditingDevice(null);
  };

  const onDeviceFormSuccess = () => {
    closeDeviceForm();
    // Refresh will be handled by React Query
  };

  // Loading durumunda loading göster
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Proje erişimi yoksa ve loading de tamamlandıysa ProjectFilter kullan
  if (!hasProjectAccess) {
    return <ProjectFilter>Content will not be shown</ProjectFilter>;
  }

  return (
    <div className="flex h-full">
      <ZoneDoorTreePanel
        zones={zones}
        doors={doors}
        selectedZoneId={selectedZoneId}
        selectedDoorId={selectedDoorId}
        onZoneSelect={setSelectedZoneId}
        onDoorSelect={setSelectedDoorId}
      />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-4 md:p-8">
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
            onEditDevice={handleEditDevice}
            onNewDevice={handleNewDevice}
          />
        </div>
      </div>

      {/* Device Form Dialog */}
      <DeviceForm
        open={showDeviceForm}
        onOpenChange={setShowDeviceForm}
        device={editingDevice}
        onSuccess={onDeviceFormSuccess}
      />

      {/* QR Code Dialog */}
      <QRCodeDialog
        selectedQR={selectedQR}
        onClose={closeQRDialog}
        onDownload={handleDownloadQR}
      />

      {/* Delete Dialog */}
      <DeviceDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleBulkDelete}
      />

      {/* Location Assignment Form */}
      <AssignLocationForm
        open={showLocationForm.open}
        onOpenChange={(open) => open ? null : closeLocationForm()}
        device={showLocationForm.device}
        zones={zones}
        doors={doors}
        onAssign={handleAssignLocation}
      />
    </div>
  );
};

export default Devices;
