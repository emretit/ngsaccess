export interface CardReading {
  _id?: string;
  id?: string;
  card_no: string;
  access_granted: boolean;
  access_time: string;
  employee_id?: string | null;
  employee_name?: string | null;
  employee_photo_url?: string | null;
  device_id?: string;
  device_name?: string;
  device_location?: string;
  device_ip?: string;
  device_serial?: string;
  status?: "success" | "denied" | "unknown";
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
  [key: string]: unknown;
}

export interface Zone {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  projectId?: string;
  [key: string]: unknown;
}

export interface Door {
  _id?: string;
  id?: string;
  zone_id?: string;
  zoneId?: string;
  name: string;
  door_code?: string;
  location?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  projectId?: string;
  [key: string]: unknown;
}

export interface GroupMember {
  _id?: string;
  id?: string;
  group_id?: string;
  groupId?: string;
  employee_id?: string;
  employeeId?: string;
  project_id?: string;
  projectId?: string;
  created_at?: string;
  employees?: {
    id?: string;
    _id?: string;
    first_name?: string;
    firstName?: string;
    last_name?: string;
    lastName?: string;
    email?: string;
  };
  [key: string]: unknown;
}

export interface GroupDevice {
  _id?: string;
  id?: string;
  group_id?: string;
  groupId?: string;
  device_id?: string;
  deviceId?: string;
  project_id?: string;
  projectId?: string;
  created_at?: string;
  devices?: {
    id?: string;
    _id?: string;
    name: string;
    device_serial?: string;
    zone_id?: string;
    door_id?: string;
  };
  [key: string]: unknown;
}

export interface AccessRule {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  target_type?: "all" | "department" | "position" | "individual";
  targetType?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  days?: string[];
  access_direction?: "entry" | "exit" | "both";
  accessDirection?: string;
  priority?: number;
  is_active?: boolean;
  isActive?: boolean;
  is_template?: boolean;
  template_name?: string;
  project_id?: string;
  projectId?: string;
  created_at?: string;
  updated_at?: string;
  group_members?: GroupMember[];
  group_devices?: GroupDevice[];
  rule_employees?: Array<{
    employees: {
      id?: string;
      _id?: string;
      first_name?: string;
      last_name?: string;
    };
  }>;
  rule_devices?: Array<{
    devices: {
      id?: string;
      _id?: string;
      name: string;
      location?: string;
    };
  }>;
  rule_positions?: Array<{
    positions: {
      id?: string;
      _id?: string;
      name: string;
    };
  }>;
  rule_zones?: Array<{
    zones: {
      id?: string;
      _id?: string;
      name: string;
    };
  }>;
  rule_doors?: Array<{
    doors: {
      id?: string;
      _id?: string;
      name: string;
    };
  }>;
  [key: string]: unknown;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  target_type?: string;
  targetType?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  days?: string[];
  access_direction?: string;
  accessDirection?: string;
  priority?: number;
  isActive?: boolean;
  projectId?: string;
  [key: string]: unknown;
}

export interface RuleConflict {
  _id?: string;
  id?: string;
  rule_id_1?: string;
  rule_id_2?: string;
  conflict_type?: string;
  conflict_description?: string;
  severity?: "low" | "medium" | "high";
  resolved?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface RuleTemplate {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  template_data?: unknown;
  category?: string;
  is_system_template?: boolean;
  usage_count?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}
