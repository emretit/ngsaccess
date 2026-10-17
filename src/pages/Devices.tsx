
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DevicesContent } from '@/components/devices/DevicesContent';
import { ZoneDoorTreePanel } from '@/components/access-control/ZoneDoorTreePanel';
import { QRCodeDialog } from '@/components/devices/QRCodeDialog';
import { AssignLocationForm } from '@/components/devices/AssignLocationForm';
import { DeviceDetailsPanel } from '@/components/devices/DeviceDetailsPanel';
import { ClaimDeviceDialog } from '@/components/devices/ClaimDeviceDialog';
import { useProjectFilteredDevices } from '@/hooks/useProjectFilteredDevices';
import { useZonesAndDoors } from '@/hooks/useZonesAndDoors';
import { useQRCodeDialog } from '@/components/devices/useQRCodeDialog';
import { useLocationForm } from '@/components/devices/useLocationForm';
import { useDeviceActions } from '@/components/devices/useDeviceActions';
import { useActiveProjectScope } from '@/hooks/useActiveProjectScope';
import { notify } from '@/lib/notify';
import { Device, ServerDevice } from '@/types/device';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { DeviceListErrorBoundary } from '@/components/devices/DeviceListErrorBoundary';
import { readDeviceFilters, writeDeviceFilters, resetDeviceFiltersForProject } from '@/lib/deviceDisplay';
import { AccessDenied } from '@/components/shared/AccessDenied';
import { useToast } from '@/hooks/use-toast';

const Devices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDeviceId = searchParams.get("deviceId");
  const { projectId, loading: scopeLoading } = useActiveProjectScope();
  const previousProject = useRef<string | null>(null);
  useEffect(() => {
    if (scopeLoading) return;
    const nextProject = projectId ?? "none";
    if (previousProject.current !== null && previousProject.current !== nextProject) {
      setSearchParams(resetDeviceFiltersForProject, { replace: true });
    }
    previousProject.current = nextProject;
  }, [projectId, scopeLoading, setSearchParams]);
  const { loading: projectLoading, isAdmin } = useProjectAccess();
  const { devices, isLoading, hasProjectAccess } = useProjectFilteredDevices();
  const { zones } = useZonesAndDoors();
  const { zoneId: selectedZoneId, doorId: selectedDoorId } = readDeviceFilters(searchParams);
  const setSelectedZoneId = (zoneId: string | null) => setSearchParams(current => writeDeviceFilters(current, { zoneId, doorId: null }));
  const setSelectedDoorId = (doorId: string | null) => setSearchParams(current => writeDeviceFilters(current, { doorId }));
  
  // Device panel state: device=null → sıfırdan yeni cihaz (marka seçici), device=X → düzenleme.
  const [devicePanel, setDevicePanel] = useState<{
    open: boolean;
    device: ServerDevice | null;
  }>({
    open: false,
    device: null
  });
  const [claimOpen, setClaimOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const device = devices.find((candidate) => candidate._id === requestedDeviceId);
    if (device) setDevicePanel((previous) => previous.open && previous.device?._id === device._id ? previous : { open: true, device });
    else setDevicePanel((previous) => previous.device ? { open: false, device: null } : previous);
  }, [devices, isLoading, requestedDeviceId]);

  const setDeviceUrl = (deviceId: string | null) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (deviceId) next.set("deviceId", deviceId);
      else next.delete("deviceId");
      return next;
    }, { replace: true });
  };

  
  const { toast } = useToast();
  
  // QR Dialog
  const { selectedQR, handleQRClick, handleDownloadQR, closeQRDialog } = useQRCodeDialog();
  
  // Location form
  const { showLocationForm, openLocationForm, closeLocationForm, handleAssignLocation } = useLocationForm();
  
  // Device actions
  const { handleDeleteDevice } = useDeviceActions();
  
  // "Yeni Cihaz Ekle" — sıfırdan oluşturma (marka seçici → form), aktif projeye yazar.
  const handleNewDevice = () => {
    setDeviceUrl(null);
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
    await releaseDeviceMut({ deviceId: device._id });
    notify.success("Cihaz havuza geri alındı");
  };

  const handleEditDevice = (device: Device) => {
    setDeviceUrl(device._id);
    setDevicePanel({ open: true, device });
  };

  const handleDevicePanelClose = () => {
    setDeviceUrl(null);
    setDevicePanel({ open: false, device: null });
  };

  const handleDevicePanelSuccess = () => {
    setDeviceUrl(null);
    setDevicePanel({ open: false, device: null });

  };

  // Proje erişimi yoksa ve loading de tamamlandıysa mesaj göster
  if (!projectLoading && !isLoading && !hasProjectAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-full min-w-0">
      <ZoneDoorTreePanel
          selectedZoneId={selectedZoneId}
          selectedDoorId={selectedDoorId}
          onSelectZone={setSelectedZoneId}
          onSelectDoor={setSelectedDoorId}
        />

      <div className="flex-1 min-w-0 space-y-3">
        {projectLoading ? <SectionSkeleton rows={5} label="Proje yükleniyor" /> : <DevicesContent
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
        />}
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

const DevicesPage = () => <DeviceListErrorBoundary><Devices /></DeviceListErrorBoundary>;

export default DevicesPage;
