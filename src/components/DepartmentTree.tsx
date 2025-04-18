
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    <div className="space-y-2">
      <h2 className="text-lg font-semibold mb-4">Departmanlar</h2>
      <div className="space-y-1">
        {departments.map((dept) => (
          <button
            key={dept.id}
            onClick={() => handleDepartmentClick(dept.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedDepartment === dept.id
                ? 'bg-primary text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            style={{ marginLeft: `${dept.level * 12}px` }}
          >
            {dept.name}
          </button>
        ))}
      </div>
    </div>
  );
}
