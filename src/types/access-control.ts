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
    access_rule_granted?: boolean;
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

export interface GroupMember {
  id: number;
  group_id: number;
  employee_id: number;
  project_id?: number;
  created_at: string;
  employees?: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
  };
}

export interface GroupDevice {
  id: number;
  group_id: number;
  device_id: number;
  project_id?: number;
  created_at: string;
  devices?: {
    id: number;
    name: string;
    device_serial?: string;
    zone_id?: number;
    door_id?: number;
  };
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
  // New group-based relations
  group_members?: GroupMember[];
  group_devices?: GroupDevice[];
  // Legacy relations (keeping for backward compatibility)
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
