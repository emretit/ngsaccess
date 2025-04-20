
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FolderTree } from 'lucide-react';
import { 
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
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

  useEffect(() => {
    fetchDepartments();
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

  const handleDepartmentClick = (id: number) => {
    const newSelectedId = selectedDepartment === id ? null : id;
    setSelectedDepartment(newSelectedId);
    onSelectDepartment(newSelectedId);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <FolderTree className="h-4 w-4" />
        Departmanlar
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {departments.map((dept) => (
            <SidebarMenuItem key={dept.id}>
              <SidebarMenuButton
                onClick={() => handleDepartmentClick(dept.id)}
                className={cn(
                  'w-full',
                  selectedDepartment === dept.id && 'bg-burgundy/10 text-burgundy'
                )}
                style={{ marginLeft: `${dept.level * 12}px` }}
              >
                {dept.name}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
