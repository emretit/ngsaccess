
export interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  created_at?: string;
  updated_at?: string;
}
