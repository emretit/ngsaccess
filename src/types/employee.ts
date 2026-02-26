export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  tc_no: string;
  card_number: string;
  photo_url: string | null;
  shift: string | null;
  company_id: string | null;
  department_id: string | null;
  position_id: string | null;
  shift_id: string | null;
  access_rule_id: string | null;
  access_rule?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  notes?: string;
  departments?: {
    id: string;
    name: string;
  } | null;
  positions?: {
    id: string;
    name: string;
  } | null;
}
