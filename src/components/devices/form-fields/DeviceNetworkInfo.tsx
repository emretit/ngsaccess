
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Ağ ve Donanım Bilgileri</h3>
        <p className="text-sm text-muted-foreground">
          Cihazın ağ ve donanım bilgilerini giriniz (isteğe bağlı)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>MAC Adresi</Label>
          <Input 
            placeholder="00:00:00:00:00:00" 
            value={macAddress}
            onChange={(e) => onMacAddressChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>IP Adresi</Label>
          <Input 
            placeholder="192.168.1.100" 
            value={ipAddress}
            onChange={(e) => onIpAddressChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Firmware Versiyonu</Label>
        <Input 
          placeholder="v1.0.0" 
          value={firmwareVersion}
          onChange={(e) => onFirmwareVersionChange(e.target.value)}
        />
      </div>
    </div>
  );
}
