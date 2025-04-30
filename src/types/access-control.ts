
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

export interface Zone {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Door {
  id: number;
  zone_id?: number;
  name: string;
  door_code?: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CardReading {
  id: number;
  employee_name: string;
  card_no: string;
  access_time: string;
  device_name: string;
  access_granted: boolean;
  status: string;
  device_location: string;
  employees?: {
    departments?: {
      name: string;
    } | null;
  } | null;
}
