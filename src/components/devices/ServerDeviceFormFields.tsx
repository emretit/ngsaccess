
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
        label="Device Name"
        name="name"
        value={name}
        onChange={onNameChange}
        required
      />

      <FormTextField
        label="Serial Number"
        name="serial_number"
        value={serialNumber}
        onChange={onSerialNumberChange}
        required
      />

      <FormSelectField
        label="Device Model"
        name="device_model"
        value={deviceModel}
        onChange={(value) => onDeviceModelChange(value as typeof deviceModel)}
        options={[
          { id: "QR Reader", name: "QR Reader" },
          { id: "Fingerprint Reader", name: "Fingerprint Reader" },
          { id: "RFID Reader", name: "RFID Reader" },
          { id: "Access Control Terminal", name: "Access Control Terminal" },
          { id: "Other", name: "Other" }
        ]}
        required
      />

      <FormSelectField
        label="Project"
        name="project"
        value={projectId}
        onChange={onProjectChange}
        options={projects.map(project => ({
          id: project.id.toString(),
          name: project.name
        }))}
        placeholder="Select Project"
      />

      <FormSelectField
        label="Bölge"
        name="zone"
        value={zoneId}
        onChange={onZoneChange}
        options={zones.map(zone => ({
          id: String(zone.id),
          name: zone.name
        }))}
        placeholder="Bölge Seçiniz"
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
        placeholder={zoneId ? (filteredDoors.length === 0 ? "Seçili bölgede kapı yok" : "Kapı Seçiniz") : "Önce bölge seçiniz"}
        required
        disabled={!zoneId}
      />

      <div className="space-y-1">
        <label htmlFor="expiry_date" className="text-sm font-medium">
          Expiry Date
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
