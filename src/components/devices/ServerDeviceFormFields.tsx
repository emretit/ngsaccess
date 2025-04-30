
import { Project } from "@/types/device";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { DeviceBasicInfo } from "./form-fields/DeviceBasicInfo";
import { DeviceNetworkInfo } from "./form-fields/DeviceNetworkInfo";
import { DeviceLocationInfo } from "./form-fields/DeviceLocationInfo";
import { DeviceAdditionalInfo } from "./form-fields/DeviceAdditionalInfo";

interface ServerDeviceFormFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  serialNumber: string;
  onSerialNumberChange: (value: string) => void;
  deviceModel: "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other";
  onDeviceModelChange: (value: "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other") => void;
  projectId: string;
  onProjectChange: (value: string) => void;
  expiryDate: string;
  onExpiryDateChange: (value: string) => void;
  projects: Project[];
  zoneId: string;
  onZoneChange: (value: string) => void;
  doorId: string;
  onDoorChange: (value: string) => void;
  description?: string;
  onDescriptionChange?: (value: string) => void;
  ipAddress?: string;
  onIpAddressChange?: (value: string) => void;
  macAddress?: string;
  onMacAddressChange?: (value: string) => void;
  isActive?: boolean;
  onIsActiveChange?: (value: boolean) => void;
  firmwareVersion?: string;
  onFirmwareVersionChange?: (value: string) => void;
}

export function ServerDeviceFormFields({
  name,
  onNameChange,
  serialNumber,
  onSerialNumberChange,
  deviceModel,
  onDeviceModelChange,
  projectId,
  onProjectChange,
  expiryDate,
  onExpiryDateChange,
  projects,
  zoneId,
  onZoneChange,
  doorId,
  onDoorChange,
  description = "",
  onDescriptionChange = () => {},
  ipAddress = "",
  onIpAddressChange = () => {},
  macAddress = "",
  onMacAddressChange = () => {},
  isActive = true,
  onIsActiveChange = () => {},
  firmwareVersion = "",
  onFirmwareVersionChange = () => {},
}: ServerDeviceFormFieldsProps) {
  const { zones, doors, loading } = useZonesAndDoors();

  return (
    <div className="space-y-5 py-4">
      <DeviceBasicInfo 
        name={name}
        onNameChange={onNameChange}
        serialNumber={serialNumber}
        onSerialNumberChange={onSerialNumberChange}
        deviceModel={deviceModel}
        onDeviceModelChange={onDeviceModelChange}
        isActive={isActive}
        onIsActiveChange={onIsActiveChange}
      />

      <DeviceNetworkInfo
        ipAddress={ipAddress}
        onIpAddressChange={onIpAddressChange}
        macAddress={macAddress}
        onMacAddressChange={onMacAddressChange}
        firmwareVersion={firmwareVersion}
        onFirmwareVersionChange={onFirmwareVersionChange}
      />

      <DeviceLocationInfo
        projectId={projectId}
        onProjectChange={onProjectChange}
        zoneId={zoneId}
        onZoneChange={onZoneChange}
        doorId={doorId}
        onDoorChange={onDoorChange}
        projects={projects}
        zones={zones}
        doors={doors}
        loading={loading}
      />

      <DeviceAdditionalInfo
        description={description}
        onDescriptionChange={onDescriptionChange}
        expiryDate={expiryDate}
        onExpiryDateChange={onExpiryDateChange}
      />
    </div>
  );
}
