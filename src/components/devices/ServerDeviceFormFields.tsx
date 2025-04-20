
import { FormSelectField, FormTextField } from "@/components/employees/FormFields";
import { Project } from "@/types/device";
import { Input } from "../ui/input";

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
}: ServerDeviceFormFieldsProps) {
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
