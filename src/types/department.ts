export interface Department {
  _id?: string;
  id?: string;
  name: string;
  parent_id?: string | null;
  parentId?: string | null;
  level?: number;
  created_at?: string;
  updated_at?: string;
  projectId?: string;
  [key: string]: unknown;
}
