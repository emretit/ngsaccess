export interface CardReading {
  id: string;
  card_no: string;
  access_granted: boolean;
  access_time: string;
  employee_id: string | null;
  employee_name: string | null;
  employee_photo_url: string | null;
  device_id: string;
  device_name: string;
  device_location: string;
  device_ip: string;
  device_serial: string;
  status: "success" | "denied" | "unknown";
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
  devices?: {
    name: string;
    device_serial?: string;
  } | null;
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Door {
  id: string;
  zone_id?: string;
  name: string;
  door_code?: string;
  location?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  employee_id: string;
  project_id?: string;
  created_at: string;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  };
}

export interface GroupDevice {
  id: string;
  group_id: string;
  device_id: string;
  project_id?: string;
  created_at: string;
  devices?: {
    id: string;
    name: string;
    device_serial?: string;
    zone_id?: string;
    door_id?: string;
  };
}

export interface AccessRule {
  id: string;
  name: string;
  description?: string;
  target_type: "all" | "department" | "position" | "individual";
  start_time?: string;
  end_time?: string;
  days: string[];
  access_direction: "entry" | "exit" | "both";
  priority: number;
  is_active: boolean;
  is_template: boolean;
  template_name?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
  group_members?: GroupMember[];
  group_devices?: GroupDevice[];
  rule_employees?: Array<{
    employees: {
      id: string;
      first_name: string;
      last_name: string;
    };
  }>;
  rule_devices?: Array<{
    devices: {
      id: string;
      name: string;
      location: string;
    };
  }>;
  rule_positions?: Array<{
    positions: {
      id: string;
      name: string;
    };
  }>;
  rule_zones?: Array<{
    zones: {
      id: string;
      name: string;
    };
  }>;
  rule_doors?: Array<{
    doors: {
      id: string;
      name: string;
    };
  }>;
}

export interface RuleConflict {
  id: string;
  rule_id_1: string;
  rule_id_2: string;
  conflict_type: string;
  conflict_description: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleTemplate {
  id: string;
  name: string;
  description?: string;
  template_data: unknown;
  category: string;
  is_system_template: boolean;
  usage_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
