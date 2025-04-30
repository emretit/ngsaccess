
import { FormTextField, FormSelectField } from "@/components/employees/FormFields";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface DeviceBasicInfoProps {
  name: string;
  onNameChange: (value: string) => void;
  serialNumber: string;
  onSerialNumberChange: (value: string) => void;
  deviceModel: "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other";
  onDeviceModelChange: (value: "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other") => void;
  isActive?: boolean;
  onIsActiveChange?: (value: boolean) => void;
}

export function DeviceBasicInfo({
  name,
  onNameChange,
  serialNumber,
  onSerialNumberChange,
  deviceModel,
  onDeviceModelChange,
  isActive = true,
  onIsActiveChange
}: DeviceBasicInfoProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">Cihaz Durumu</h3>
        <div className="flex items-center space-x-2">
          <Switch 
            id="is-active" 
            checked={isActive}
            onCheckedChange={onIsActiveChange}
          />
          <Label htmlFor="is-active" className="text-sm">
            {isActive ? "Aktif" : "Pasif"}
          </Label>
        </div>
      </div>

      <FormTextField
        label="Cihaz Adı"
        name="name"
        value={name}
        onChange={onNameChange}
        required
      />

      <FormTextField
        label="Seri Numarası"
        name="serial_number"
        value={serialNumber}
        onChange={onSerialNumberChange}
        required
      />

      <FormSelectField
        label="Cihaz Modeli"
        name="device_model"
        value={deviceModel}
        onChange={(value) => onDeviceModelChange(value as typeof deviceModel)}
        options={[
          { id: "QR Reader", name: "QR Okuyucu" },
          { id: "Fingerprint Reader", name: "Parmak İzi Okuyucu" },
          { id: "RFID Reader", name: "RFID Kart Okuyucu" },
          { id: "Access Control Terminal", name: "Geçiş Kontrol Terminali" },
          { id: "Other", name: "Diğer" }
        ]}
        required
      />
    </>
  );
}
