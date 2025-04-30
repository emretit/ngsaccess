
import { FormSelectField, FormTextField } from "@/components/employees/FormFields";
import { Project } from "@/types/device";
import { Input } from "../ui/input";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";

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
}: ServerDeviceFormFieldsProps) {
  const { zones, doors, loading } = useZonesAndDoors();

  // Kapı listesini seçili bölgeye göre filtrele
  const filteredDoors = doors.filter(door => String(door.zone_id) === zoneId);

  return (
    <div className="space-y-4">
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
        required
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
        required
        disabled={!zoneId || loading}
      />

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
      </div>
    </div>
  );
}
