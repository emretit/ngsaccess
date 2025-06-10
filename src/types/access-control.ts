
export interface CardReading {
    id: number;
    card_no: string;
    access_granted: boolean;
    access_time: string;
    employee_id: number | null;
    employee_name: string | null;
    employee_photo_url: string | null;
    device_id: number | string;
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
  name: string;
  description?: string;
  target_type: 'all' | 'department' | 'position' | 'individual';
  start_time?: string;
  end_time?: string;
  days: string[];
  access_direction: 'entry' | 'exit' | 'both';
  priority: number;
  is_active: boolean;
  is_template: boolean;
  template_name?: string;
  project_id?: number;
  created_at: string;
  updated_at: string;
  // Relations
  rule_employees?: Array<{
    employees: {
      id: number;
      first_name: string;
      last_name: string;
    };
  }>;
  rule_devices?: Array<{
    devices: {
      id: number;
      name: string;
      location: string;
    };
  }>;
  rule_positions?: Array<{
    positions: {
      id: number;
      name: string;
    };
  }>;
  rule_zones?: Array<{
    zones: {
      id: number;
      name: string;
    };
  }>;
  rule_doors?: Array<{
    doors: {
      id: number;
      name: string;
    };
  }>;
}

export interface RuleConflict {
  id: number;
  rule_id_1: number;
  rule_id_2: number;
  conflict_type: string;
  conflict_description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleTemplate {
  id: number;
  name: string;
  description?: string;
  template_data: any;
  category: string;
  is_system_template: boolean;
  usage_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
