
export interface CardReading {
    id: number;
    card_no: string;
    access_granted: boolean;
    access_time: string;
    employee_id: number | null;
    employee_name: string | null;
    employee_photo_url: string | null;
    device_id: string;
    device_name: string;
    device_location: string;
    device_ip: string;
    device_serial: string;
    status: 'success' | 'denied' | 'unknown';
    read_type?: string;
    raw_data?: string;
    created_at?: string;
    updated_at?: string;
    read_time?: string;
    employees?: {
        departments?: {
            name: string;
        } | null;
    } | null;
}

export interface Zone {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Door {
  id: number;
  zone_id?: number;
  name: string;
  door_code?: string;
  location?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AccessRule {
  id: number;
  employee_id?: number;
  device_id?: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  type: string;
  days: string[];
  created_at: string;
  updated_at: string;
}
