
import { FormSelectField, FormTextField } from "@/components/employees/FormFields";
import { Project } from "@/types/device";
import { Input } from "../ui/input";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";

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
  onDescriptionChange,
  ipAddress = "",
  onIpAddressChange,
  macAddress = "",
  onMacAddressChange,
  isActive = true,
  onIsActiveChange,
  firmwareVersion = "",
  onFirmwareVersionChange,
}: ServerDeviceFormFieldsProps) {
  const { zones, doors, loading } = useZonesAndDoors();

  // Kapı listesini seçili bölgeye göre filtrele
  const filteredDoors = doors.filter(door => String(door.zone_id) === zoneId);

  return (
    <div className="space-y-5 py-4">
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

      <FormTextField
        label="IP Adresi"
        name="ip_address"
        value={ipAddress}
        onChange={onIpAddressChange || (() => {})}
        placeholder="Örn: 192.168.1.100"
      />

      <FormTextField
        label="MAC Adresi"
        name="mac_address"
        value={macAddress}
        onChange={onMacAddressChange || (() => {})}
        placeholder="Örn: AA:BB:CC:DD:EE:FF"
      />

      <FormTextField
        label="Firmware Versiyonu"
        name="firmware_version"
        value={firmwareVersion}
        onChange={onFirmwareVersionChange || (() => {})}
        placeholder="Örn: v1.2.3"
      />

      <FormSelectField
        label="Proje"
        name="project"
        value={projectId}
        onChange={onProjectChange}
        options={projects.map(project => ({
          id: project.id.toString(),
          name: project.name
        }))}
        placeholder="Proje Seçiniz"
      />

      <FormSelectField
        label="Bölge"
        name="zone"
        value={zoneId}
        onChange={(val) => {
          onZoneChange(val);
          if (val !== zoneId) {
            // Bölge değiştiğinde kapı seçimini sıfırla
            onDoorChange('');
          }
        }}
        options={zones.map(zone => ({
          id: String(zone.id),
          name: zone.name
        }))}
        placeholder={loading ? "Yükleniyor..." : "Bölge Seçiniz"}
      />

      <FormSelectField
        label="Kapı"
        name="door"
        value={doorId}
        onChange={onDoorChange}
        options={filteredDoors.map(door => ({
          id: String(door.id),
          name: door.name
        }))}
        placeholder={zoneId 
          ? (filteredDoors.length === 0 
              ? "Seçili bölgede kapı yok" 
              : "Kapı Seçiniz") 
          : "Önce bölge seçiniz"}
        disabled={!zoneId || loading}
      />

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange && onDescriptionChange(e.target.value)}
          placeholder="Cihaz hakkında detaylı bilgi giriniz..."
          className="resize-none h-24"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="expiry_date" className="text-sm font-medium">
          Son Kullanma Tarihi
        </label>
        <Input
          id="expiry_date"
          type="date"
          value={expiryDate}
          onChange={(e) => onExpiryDateChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Eğer cihazın bir son kullanma tarihi varsa belirtin, yoksa boş bırakın.
        </p>
      </div>
    </div>
  );
}
