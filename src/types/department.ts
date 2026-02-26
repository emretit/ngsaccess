export interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
  created_at?: string;
  updated_at?: string;
}
