
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeviceNetworkInfoProps {
  ipAddress: string;
  onIpAddressChange: (value: string) => void;
  macAddress: string;
  onMacAddressChange: (value: string) => void;
  firmwareVersion: string;
  onFirmwareVersionChange: (value: string) => void;
}

export function DeviceNetworkInfo({
  ipAddress,
  onIpAddressChange,
  macAddress,
  onMacAddressChange,
  firmwareVersion,
  onFirmwareVersionChange
}: DeviceNetworkInfoProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="ip_address">IP Adresi</Label>
        <Input 
          id="ip_address"
          value={ipAddress}
          onChange={(e) => onIpAddressChange(e.target.value)}
          placeholder="Örn: 192.168.1.100"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mac_address">MAC Adresi</Label>
        <Input 
          id="mac_address"
          value={macAddress}
          onChange={(e) => onMacAddressChange(e.target.value)}
          placeholder="Örn: AA:BB:CC:DD:EE:FF"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="firmware_version">Firmware Versiyonu</Label>
        <Input 
          id="firmware_version"
          value={firmwareVersion}
          onChange={(e) => onFirmwareVersionChange(e.target.value)}
          placeholder="Örn: v1.2.3"
        />
      </div>
    </>
  );
}
