
export interface Device {
  id: string;
  device_name?: string;
  name?: string; // For compatibility with existing code
  device_serial?: string;
  serial_number?: string; // For compatibility with existing code
  device_model?: string;
  device_location?: string;
  device_type?: string;
  status: 'online' | 'offline' | 'expired';
  created_at?: string;
  last_used_at?: string | null;
  // Added required fields from DB schema
  location?: string;
  type?: string;
  // Add zone_id and door_id for location display
  zone_id?: number;
  door_id?: number;
}

export interface Project {
  id: number;
  name: string;
}

export interface ServerDevice {
  id: string;
  name: string;
  serial_number: string;
  device_model_enum: "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other";
  project_id?: number;
  date_added: string;
  expiry_date?: string;
  projects?: {
    name: string;
  };
  status?: 'online' | 'offline' | 'expired' | 'active' | 'inactive';
  created_at?: string;
  device_type?: string;
  device_model?: string;
  device_status?: string;
  last_used_at?: string;
  updated_at?: string;
  device_location?: string;
  zone_id?: number;
  door_id?: number;
  description?: string;
  device_ip?: string;
  device_mac?: string;
  device_firmware?: string;
}
