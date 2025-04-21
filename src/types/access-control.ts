
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

// Define types for the create_access_rule parameters
export interface CreateAccessRuleParams {
  p_type: string;
  p_employee_id: number | null;
  p_device_id: number;
  p_days: string[];
  p_start_time: string;
  p_end_time: string;
  p_department_ids: number[] | null;
  p_user_ids: number[] | null;
  p_door_ids: number[] | null;
  p_zone_ids?: number[] | null;
}

// Define a type for the function's return value
export interface CreateAccessRuleResult {
  success: boolean;
}

// Extend the Supabase client type to recognize our function
declare module '@supabase/supabase-js' {
  interface SupabaseClient<Database> {
    rpc<T = CreateAccessRuleResult>(
      fn: 'create_access_rule',
      params: CreateAccessRuleParams
    ): Promise<{
      data: T | null;
      error: any;
    }>;
  }
}
