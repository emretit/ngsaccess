export interface GeneralSettings {
  id?: string;
  company_name: string;
  tax_number?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  system_language?: string;
  timezone?: string;
  date_format?: string;
  currency?: string;
  dark_mode?: boolean;
  notifications_enabled?: boolean;
  working_hours_start?: string;
  working_hours_end?: string;
}

export interface CompanyInfo {
  id?: number;
  name: string;
  tax_number?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  currency?: string;
  logo_url?: string;
  project_id?: number;
  updated_at?: string;
}

export interface GeneralSettingsFormData {
  companyName: string;
  taxNumber: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  darkMode: boolean;
  notifications: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
}