
export interface AccessRuleFormData {
  name: string;
  description?: string;
  departments: Array<{ type: "department"; id: number; name: string }>;
  employees: Array<{ type: "employee"; id: number; name: string }>;
  zones: Array<{ type: "zone"; id: number; name: string }>;
  doors: Array<{ type: "door"; id: number; name: string }>;
  start_time: string;
  end_time: string;
  days: string[];
  is_active: boolean;
}

export interface AccessRule {
  id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  days: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  departments: Array<{ id: number; name: string }>;
  employees: Array<{ id: number; name: string }>;
  zones: Array<{ id: number; name: string }>;
  doors: Array<{ id: number; name: string }>;
}
