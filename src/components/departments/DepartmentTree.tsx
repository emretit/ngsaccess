
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
}

interface DepartmentTreeProps {
  onSelectDepartment: (id: number | null) => void;
}

export default function DepartmentTree({ onSelectDepartment }: DepartmentTreeProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("Ana Proje");

  useEffect(() => {
    fetchDepartments();
    fetchProjectName();
  }, []);

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('level', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  }

  async function fetchProjectName() {
    const { data, error } = await supabase
      .from("projects")
      .select("name")
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data?.name) setProjectName(data.name);
  }

  const handleDepartmentClick = (id: number) => {
    const newSelectedId = selectedDepartment === id ? null : id;
    setSelectedDepartment(newSelectedId);
    onSelectDepartment(newSelectedId);
  };

  return (
    <div className="h-full w-[280px] bg-card rounded-lg border shadow">
      <div className="p-4 border-b space-y-1.5">
        <div className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">{projectName}</h2>
        </div>
        <p className="text-sm text-muted-foreground">Departmanlar</p>
      </div>
      <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <ul role="tree" className="space-y-0.5">
          {departments.map((dept) => (
            <li role="treeitem" key={dept.id}>
              <div
                className={cn(
                  "group flex items-center gap-2 rounded-md p-2 transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedDepartment === dept.id && "bg-accent/80 text-accent-foreground font-medium"
                )}
                style={{ paddingLeft: `${16 + dept.level * 16}px` }}
                onClick={() => handleDepartmentClick(dept.id)}
                tabIndex={0}
                aria-selected={selectedDepartment === dept.id}
              >
                <span className="flex-1 truncate text-sm">{dept.name}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
