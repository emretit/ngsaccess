export type AccessDirection = "entry" | "exit" | "both";

export interface Device {
  id: string;
  device_name?: string;
  name?: string;
  device_serial?: string;
  serial_number?: string;
  device_model?: string;
  device_location?: string;
  device_type?: string;
  status: "online" | "offline" | "expired";
  created_at?: string;
  last_used_at?: string | null;
  type?: string;
  zone_id?: string;
  door_id?: string;
  access_direction?: AccessDirection;
  device_mac?: string;
  device_ip?: string;
  device_firmware?: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface ServerDevice {
  id: string;
  name: string;
  serial_number: string;
  device_model_enum:
    | "QR Reader"
    | "Fingerprint Reader"
    | "RFID Reader"
    | "Access Control Terminal"
    | "Other";
  project_id?: string;
  date_added: string;
  expiry_date?: string;
  projects?: {
    name: string;
  };
  status?: "online" | "offline" | "expired" | "active" | "inactive";
  created_at?: string;
  device_type?: string;
  device_model?: string;
  device_status?: string;
  last_used_at?: string;
  updated_at?: string;
  device_location?: string;
  zone_id?: string;
  door_id?: string;
  description?: string;
  device_ip?: string;
  device_mac?: string;
  device_firmware?: string;
  access_direction?: AccessDirection;
}
