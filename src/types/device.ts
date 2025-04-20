export interface Device {
  id: string;
  name: string;
  serial_number: string;
  device_model: string;
  project_id: number;
  last_used_at: string | null;
  status: 'active' | 'inactive';
}

export interface Project {
  id: number;
  name: string;
}

export interface ServerDevice {
  id: string;
  name: string;
  serial_number: string;
  device_model_enum?: string;
  project_id?: number;
  date_added: string;
  expiry_date?: string;
  projects?: {
    name: string;
  };
}
