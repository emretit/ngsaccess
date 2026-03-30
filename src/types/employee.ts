export interface Employee {
  _id?: string;
  id?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  email?: string;
  tc_no?: string;
  tcNo?: string;
  card_number?: string;
  cardNumber?: string;
  photo_url?: string | null;
  shift?: string | null;
  company_id?: string | null;
  companyId?: string | null;
  department_id?: string | null;
  departmentId?: string | null;
  position_id?: string | null;
  positionId?: string | null;
  shift_id?: string | null;
  shiftId?: string | null;
  access_rule_id?: string | null;
  accessRuleId?: string | null;
  access_rule?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  isActive?: boolean;
  notes?: string;
  projectId?: string;
  departments?: {
    id?: string;
    _id?: string;
    name: string;
  } | null;
  positions?: {
    id?: string;
    _id?: string;
    name: string;
  } | null;
  [key: string]: unknown;
}
