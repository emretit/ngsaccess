import { usePermissions } from "@/hooks/usePermissions";
import { useDeviceDeepLink, useDeviceUrlSync } from "@/components/devices/useDeviceDeepLink";
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DevicesContent } from '@/components/devices/DevicesContent';
import { LocationTree } from '@/components/devices/LocationTree';
import { QRCodeDialog } from '@/components/devices/QRCodeDialog';
import { AssignLocationForm } from '@/components/devices/AssignLocationForm';
import { DeviceDetailsPanel } from '@/components/devices/DeviceDetailsPanel';
import { ClaimDeviceDialog } from '@/components/devices/ClaimDeviceDialog';
import { VirtualReaderDialog, type VirtualReaderDialogState } from '@/components/devices/VirtualReaderDialog';
import { isVirtualReader } from '../../convex/lib/virtualReader';
import { useProjectFilteredDevices } from '@/hooks/useProjectFilteredDevices';
import { useZonesAndDoors } from '@/hooks/useZonesAndDoors';
import { useQRCodeDialog } from '@/components/devices/useQRCodeDialog';
import { useLocationForm } from '@/components/devices/useLocationForm';
import { useDeviceActions } from '@/components/devices/useDeviceActions';
import { useActiveProjectScope } from '@/hooks/useActiveProjectScope';
import { notify } from '@/lib/notify';
import { Device, ServerDevice } from '@/types/device';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { DeviceListErrorBoundary } from '@/components/devices/DeviceListErrorBoundary';
import { readDeviceFilters, writeDeviceFilters, resetDeviceFiltersForProject } from '@/lib/deviceDisplay';
import { EmptyState } from '@/components/shared/EmptyState';
import { AccessDenied } from '@/components/shared/AccessDenied';

const Devices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const syncDeviceUrl = useDeviceUrlSync();
  const requestedDeviceId = searchParams.get("deviceId");
  const { projectId, loading: scopeLoading } = useActiveProjectScope();
  const previousProject = useRef<string | null>(null);
  useEffect(() => {
    if (scopeLoading) return;
    const nextProject = projectId ?? "none";
    if (previousProject.current !== null && previousProject.current !== nextProject) {
      syncDeviceUrl(resetDeviceFiltersForProject);
    }
    previousProject.current = nextProject;
  }, [projectId, scopeLoading, syncDeviceUrl]);
  const { loading: projectLoading } = useProjectAccess();
  const { can } = usePermissions();
  const canManage = can("devices.manage");
  const { devices, isLoading, hasProjectAccess } = useProjectFilteredDevices();
  const { zones, doors } = useZonesAndDoors();
  const { zoneId: selectedZoneId, doorId: selectedDoorId } = readDeviceFilters(searchParams);
  const setSelectedZoneId = (zoneId: string | null) => setSearchParams(current => writeDeviceFilters(current, { zoneId, doorId: null }));
  const setSelectedDoorId = (doorId: string | null) => setSearchParams(current => writeDeviceFilters(current, { doorId, ...(doorId ? { zoneId: doors.find(door => door._id === doorId)?.zoneId ?? null } : {}) }));

  // Device panel state: device=null → sıfırdan yeni cihaz (marka seçici), device=X → düzenleme.
  const [devicePanel, setDevicePanel] = useState<{
    open: boolean;
    device: ServerDevice | null;
    projectId: typeof projectId;
  }>({
    open: false,
    device: null,
    projectId
  });
  const [claimOpen, setClaimOpen] = useState(false);
  const [virtualReader, setVirtualReader] = useState<VirtualReaderDialogState | null>(null);

  const consumeDeviceRequest = useDeviceDeepLink(requestedDeviceId, devices, isLoading, devicePanel.open,
    device => setDevicePanel({ open: true, device, projectId }),
    devicePanel.device?._id ?? null, setDeviceUrl);

  function setDeviceUrl(deviceId: string | null) {
    syncDeviceUrl((previous) => {
      const next = new URLSearchParams(previous);
      if (deviceId) next.set("deviceId", deviceId);
      else next.delete("deviceId");
      return next;
    });
  };

  // QR Dialog
  const { selectedQR, handleQRClick, handleDownloadQR, closeQRDialog } = useQRCodeDialog();
  // Sanal okuyucunun kimlik QR'ı yok; aynı menü satırı okuyucu ekranı bağlantısını açar.
  const handleDeviceQRClick = (device: Device) => {
    if (!isVirtualReader(device)) return handleQRClick(device);
    if (device.apiToken) setVirtualReader({ mode: "link", name: device.name, readerToken: device.apiToken });
  };

  // Location form
  const { showLocationForm, openLocationForm, closeLocationForm, handleAssignLocation } = useLocationForm();

  // Device actions
  const { handleDeleteDevice } = useDeviceActions();

  // "Yeni Cihaz Ekle" — sıfırdan oluşturma (marka seçici → form), aktif projeye yazar.
  const handleNewDevice = () => {
    setDeviceUrl(null);
    setDevicePanel({ open: true, device: null, projectId });
  };

  // "Buluttan Ekle" — havuzdaki (atanmamış) cihazı aktif projeye claim eder.
  const handleClaimFromCloud = () => {
    setClaimOpen(true);
  };

  const handleClaimSuccess = () => {
    setClaimOpen(false);
    notify.success("Cihaz projeye atandı");
  };

  // Cihazı projeden çıkarıp havuza geri al (door/okuma silinir, cihaz havuzda kalır).
  const releaseDeviceMut = useMutation(api.devices.releaseDevice);
  const handleReleaseDevice = async (device: Device) => {
    await releaseDeviceMut({ deviceId: device._id });
    notify.success("Cihaz havuza geri alındı");
  };

  const handleEditDevice = (device: Device) => {
    consumeDeviceRequest(device._id);
    setDeviceUrl(device._id);
    setDevicePanel({ open: true, device, projectId });
  };

  const handleDevicePanelClose = () => {
    consumeDeviceRequest(devicePanel.device?._id ?? requestedDeviceId);
    setDeviceUrl(null);
    setDevicePanel(current => ({ ...current, open: false }));
  };

  const handleDevicePanelSuccess = () => {
    setDeviceUrl(null);
    setDevicePanel(current => ({ ...current, open: false }));
  };

  const liveSelectedDevice = devices.find(device => device._id === devicePanel.device?._id);
  const deviceDetailsPanel = <DeviceDetailsPanel
    open={devicePanel.open}
    onClose={handleDevicePanelClose}
    deviceUnavailable={devicePanel.open && !!devicePanel.device && !isLoading && !liveSelectedDevice}
    deviceId={devicePanel.device?._id}
    selectedDevice={liveSelectedDevice ?? devicePanel.device}
    projectId={devicePanel.projectId}
    onSuccess={handleDevicePanelSuccess}
  />;

  const unavailable = !projectLoading && !isLoading && !hasProjectAccess
    ? <AccessDenied />
    : !projectLoading && !scopeLoading && !projectId
      ? <EmptyState title="Proje seçin" description="Cihaz envanterini görüntülemek için üst çubuktan bir proje seçin." />
      : null;

  return (
    <>
    {unavailable ?? (
    <div className="min-h-full min-w-0 space-y-4">
      <div className="flex-1 min-w-0 space-y-3">
        <DevicesContent
          sidebar={<LocationTree
            key={projectId ?? "none"}
            selectedZoneId={selectedZoneId}
            selectedDoorId={selectedDoorId}
            onSelectZone={setSelectedZoneId}
            onSelectDoor={setSelectedDoorId}
            canManage={canManage}
          />}
          devices={devices}
          isLoading={projectLoading || isLoading}
          zones={zones}
          selectedZoneId={selectedZoneId}
          selectedDoorId={selectedDoorId}
          onDeleteDevice={handleDeleteDevice}
          onAssignLocation={openLocationForm}
          onEditDevice={handleEditDevice}
          onAddNew={handleNewDevice}
          onAddFromCloud={handleClaimFromCloud}
          onAddVirtualReader={() => setVirtualReader({ mode: "create" })}
          onQRClick={handleDeviceQRClick}
          onReleaseDevice={canManage ? handleReleaseDevice : undefined}
          canManage={canManage && !projectLoading}
        />
      </div>

      {/* Havuzdan cihaz claim */}
      <ClaimDeviceDialog
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        onSuccess={handleClaimSuccess}
      />

      <VirtualReaderDialog
        state={virtualReader}
        projectId={projectId}
        onClose={() => setVirtualReader(null)}
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
        deviceName={showLocationForm.device?.name || 'Cihaz'}
        device={showLocationForm.device ?? undefined}
      />
    </div>
    )}
    {deviceDetailsPanel}
    </>
  );
};

const DevicesPage = () => <DeviceListErrorBoundary><Devices /></DeviceListErrorBoundary>;

export default DevicesPage;
