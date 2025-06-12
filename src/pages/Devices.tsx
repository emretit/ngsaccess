
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
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const Devices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
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

  // Loading durumunda (hem project hem devices loading) loading göster
  if (projectLoading || isLoading) {
    return <LoadingSpinner text="Cihazlar yükleniyor..." />;
  }

  // Proje erişimi yoksa ve loading de tamamlandıysa mesaj göster
  if (!projectLoading && !isLoading && !hasProjectAccess) {
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
    <div className="h-[calc(100vh-4rem)] w-full bg-gray-50">
      <div className="flex h-full gap-6 p-6">
        {/* Sidebar - Zone/Door Tree */}
        <div className="flex-shrink-0">
          <ZoneDoorTreePanel
            onSelectZone={setSelectedZoneId}
            onSelectDoor={setSelectedDoorId}
          />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
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
        onAddDevice={(serialNumber: string) => console.log('Add device:', serialNumber)}
        isLoading={false}
        onOpenDevicePanel={() => setShowDeviceForm(true)}
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
