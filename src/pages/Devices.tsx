
import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { DevicesContent } from '@/components/devices/DevicesContent';
import { ZoneDoorTreePanel } from '@/components/access-control/ZoneDoorTreePanel';
import { QRCodeDialog } from '@/components/devices/QRCodeDialog';
import { DeviceDeleteDialog } from '@/components/devices/DeviceDeleteDialog';
import { AssignLocationForm } from '@/components/devices/AssignLocationForm';
import { DeviceDetailsPanel } from '@/components/devices/DeviceDetailsPanel';
import { ClaimDeviceDialog } from '@/components/devices/ClaimDeviceDialog';
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
  const { loading: projectLoading, isAdmin } = useProjectAccess();
  const { devices, isLoading, hasProjectAccess } = useProjectFilteredDevices();
  const { zones } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  
  // Device panel state: device=null → sıfırdan yeni cihaz (marka seçici), device=X → düzenleme.
  const [devicePanel, setDevicePanel] = useState<{
    open: boolean;
    device: ServerDevice | null;
  }>({
    open: false,
    device: null
  });
  const [claimOpen, setClaimOpen] = useState(false);
  
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

  // "Yeni Cihaz Ekle" — sıfırdan oluşturma (marka seçici → form), aktif projeye yazar.
  const handleNewDevice = () => {
    setDevicePanel({ open: true, device: null });
  };

  // "Buluttan Ekle" — havuzdaki (atanmamış) cihazı aktif projeye claim eder.
  const handleClaimFromCloud = () => {
    setClaimOpen(true);
  };

  const handleClaimSuccess = () => {
    setClaimOpen(false);
    toast({ title: "İşlem başarılı", description: "Cihaz projeye eklendi" });
  };

  // Cihazı projeden çıkarıp havuza geri al (door/okuma silinir, cihaz havuzda kalır).
  const releaseDeviceMut = useMutation(api.devices.releaseDevice);
  const handleReleaseDevice = async (device: Device) => {
    try {
      await releaseDeviceMut({ deviceId: device._id as Id<"devices"> });
      toast({ title: "İşlem başarılı", description: "Cihaz havuza geri alındı" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz havuza alınamadı";
      toast({ title: "Hata", description: message, variant: "destructive" });
    }
  };

  const handleEditDevice = (device: Device) => {
    setDevicePanel({ open: true, device });
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
          selectedZoneId={selectedZoneId}
          selectedDoorId={selectedDoorId}
          onDeleteDevice={handleDeleteDevice}
          onAssignLocation={openLocationForm}
          onEditDevice={handleEditDevice}
          onAddNew={handleNewDevice}
          onAddFromCloud={handleClaimFromCloud}
          onQRClick={handleQRClick}
          onReleaseDevice={isAdmin ? handleReleaseDevice : undefined}
          canManage={isAdmin}
        />
      </div>

      {/* Device Details Panel (sadece düzenleme) */}
      <DeviceDetailsPanel
        open={devicePanel.open}
        onClose={handleDevicePanelClose}
        selectedDevice={devicePanel.device}
        onSuccess={handleDevicePanelSuccess}
      />

      {/* Havuzdan cihaz claim */}
      <ClaimDeviceDialog
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        onSuccess={handleClaimSuccess}
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
        deviceName={showLocationForm.device?.name || 'Unknown Device'}
        device={showLocationForm.device ?? undefined}
      />
    </div>
  );
};

export default Devices;
