
export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  created_at: string;
  updated_at: string;
  full_name?: string;
  photo_url?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface UserFormData {
  email: string;
  password: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  projectId?: number;
}
