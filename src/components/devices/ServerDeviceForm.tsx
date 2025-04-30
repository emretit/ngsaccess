
import { Button } from "@/components/ui/button";
import { ServerDevice, Project } from '@/types/device';
import { useServerDeviceForm } from '@/hooks/useServerDeviceForm';
import { ServerDeviceFormFields } from './ServerDeviceFormFields';
import { ScrollArea } from "@/components/ui/scroll-area";

interface ServerDeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: ServerDevice | null;
  projects: Project[];
  onSuccess: () => void;
}

export function ServerDeviceForm({ 
  open, 
  onClose, 
  device, 
  projects,
  onSuccess 
}: ServerDeviceFormProps) {
  const {
    name,
    setName,
    serialNumber,
    setSerialNumber,
    deviceModel,
    setDeviceModel,
    projectId,
    setProjectId,
    expiryDate,
    setExpiryDate,
    zoneId,
    setZoneId,
    doorId,
    setDoorId,
    description,
    setDescription,
    ipAddress,
    setIpAddress,
    macAddress,
    setMacAddress,
    isActive,
    setIsActive,
    firmwareVersion,
    setFirmwareVersion,
    handleSubmit
  } = useServerDeviceForm(device || null, onSuccess);

  return (
    <div className="pt-4">
      <ScrollArea className="h-[calc(100vh-180px)] px-1">
        <form onSubmit={handleSubmit} className="space-y-6 pr-4">
          <ServerDeviceFormFields
            name={name}
            onNameChange={setName}
            serialNumber={serialNumber}
            onSerialNumberChange={setSerialNumber}
            deviceModel={deviceModel}
            onDeviceModelChange={setDeviceModel}
            projectId={projectId}
            onProjectChange={setProjectId}
            expiryDate={expiryDate}
            onExpiryDateChange={setExpiryDate}
            projects={projects}
            zoneId={zoneId}
            onZoneChange={setZoneId}
            doorId={doorId}
            onDoorChange={setDoorId}
            description={description}
            onDescriptionChange={setDescription}
            ipAddress={ipAddress}
            onIpAddressChange={setIpAddress}
            macAddress={macAddress}
            onMacAddressChange={setMacAddress}
            isActive={isActive}
            onIsActiveChange={setIsActive ? (value: boolean) => setIsActive(value) : undefined}
            firmwareVersion={firmwareVersion}
            onFirmwareVersionChange={setFirmwareVersion}
          />

          <div className="flex justify-end gap-4 pt-4 sticky bottom-0 bg-background pb-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit">
              {device ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </form>
      </ScrollArea>
    </div>
  );
}
