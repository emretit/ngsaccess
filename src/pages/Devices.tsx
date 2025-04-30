
import { Button } from "@/components/ui/button";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { useState } from "react";
import { ZoneDoorTreePanel } from "@/components/access-control/ZoneDoorTreePanel";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { AssignLocationForm } from "@/components/devices/AssignLocationForm";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Device, ServerDevice } from "@/types/device";
import { useDevices } from "@/hooks/useDevices";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { DeviceList } from "@/components/devices/DeviceList";
import { QRCodeDialog } from "@/components/devices/QRCodeDialog";
import { useDeviceFilters } from "@/hooks/useDeviceFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceDetailsPanel } from "@/components/devices/DeviceDetailsPanel";
import { Edit } from "lucide-react";

export default function Devices() {
  
  const { devices, isLoading, addDevice, isAddingDevice } = useDevices();
  const [selectedQR, setSelectedQR] = useState<{ serial: string; name: string } | null>(null);
  const { zones, doors } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLocationForm, setShowLocationForm] = useState<{open: boolean; device: Device | null}>({
    open: false, 
    device: null
  });
  
  // Device Edit Panel State
  const [devicePanel, setDevicePanel] = useState<{
    open: boolean;
    device: ServerDevice | null;
  }>({
    open: false,
    device: null
  });
  
  // Use the extracted filter hook
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    deviceTypes,
    filteredDevices
  } = useDeviceFilters(devices, selectedZoneId, selectedDoorId);

  const handleQRClick = (device: Device) => {
    setSelectedQR({
      serial: device.device_serial || device.serial_number || '',
      name: device.device_name || device.name || 'Device QR'
    });
  };

  const handleDownloadQR = () => {
    if (!selectedQR) return;
    
    const canvas = document.querySelector('#qr-large') as HTMLCanvasElement;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `qr-${selectedQR.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      toast({
        title: "Cihaz silindi",
        description: "Cihaz başarıyla silindi",
      });
      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Cihaz silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleAssignLocation = async (zoneId: number, doorId: number) => {
    if (!showLocationForm.device) return;
    
    try {
      // Update device location in database
      const { error } = await fetch(`/api/devices/${showLocationForm.device.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: zoneId,
          door_id: doorId
        })
      }).then(res => res.json());
      
      if (error) throw new Error(error);

      // Refresh devices data
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      
      toast({
        title: "Konum atandı",
        description: "Cihaz konumu başarıyla güncellendi",
      });
      
      setShowLocationForm({open: false, device: null});
    } catch (error) {
      toast({
        title: "Hata",
        description: "Konum atanırken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const openLocationForm = (device: Device) => {
    setShowLocationForm({open: true, device});
  };

  const openDevicePanel = (device: ServerDevice | null = null) => {
    setDevicePanel({
      open: true,
      device
    });
  };

  const handleDeviceEditClick = (device: Device) => {
    // Convert regular device to server device format for the form
    const serverDevice: ServerDevice = {
      id: device.id,
      name: device.name || device.device_name || '',
      serial_number: device.serial_number || device.device_serial || '',
      device_model_enum: "Other",
      date_added: device.created_at || new Date().toISOString(),
      status: device.status || 'online',
      zone_id: device.zone_id,
      door_id: device.door_id
    };
    
    openDevicePanel(serverDevice);
  };

  const handleDevicePanelSuccess = () => {
    setDevicePanel({ open: false, device: null });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    
    toast({
      title: "İşlem başarılı",
      description: "Cihaz bilgileri kaydedildi",
    });
  };

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
          <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border-0">
            <div>
              <h1 className="text-2xl font-semibold">Cihazlar</h1>
              <p className="text-sm text-muted-foreground">
                {devices.length} cihaz bulundu, {filteredDevices.length} tanesi gösteriliyor
              </p>
            </div>
            <div className="space-x-2">
              <DeviceForm onAddDevice={addDevice} isLoading={isAddingDevice} />
              <Button variant="outline" onClick={() => openDevicePanel()}>
                <Edit className="mr-2 h-4 w-4" />
                Yeni Cihaz Oluştur
              </Button>
            </div>
          </div>

          <DeviceFilters 
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            deviceTypes={deviceTypes}
          />

          <DeviceList 
            devices={devices}
            filteredDevices={filteredDevices}
            isLoading={isLoading}
            zones={zones}
            doors={doors}
            onQRClick={handleQRClick}
            onDeleteDevice={handleDeleteDevice}
            onAssignLocation={openLocationForm}
            onEditDevice={handleDeviceEditClick}
          />

          <QRCodeDialog 
            open={!!selectedQR}
            onOpenChange={() => setSelectedQR(null)}
            qrData={selectedQR}
            onDownload={handleDownloadQR}
          />
          
          {showLocationForm.open && showLocationForm.device && (
            <AssignLocationForm
              open={showLocationForm.open}
              onClose={() => setShowLocationForm({open: false, device: null})}
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
          
          {/* Device Details Panel */}
          <DeviceDetailsPanel 
            open={devicePanel.open}
            onClose={() => setDevicePanel({ open: false, device: null })}
            selectedDevice={devicePanel.device}
            onSuccess={handleDevicePanelSuccess}
          />
        </div>
      </div>
    </main>
  );
}
