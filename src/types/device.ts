
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
  status?: 'online' | 'offline' | 'expired';
  created_at?: string;
  device_type?: string;
  device_model?: string;
  device_status?: string;
  last_used_at?: string;
  updated_at?: string;
  device_location?: string;  // Added this line
}
