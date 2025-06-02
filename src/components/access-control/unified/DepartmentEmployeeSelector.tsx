
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Users, Building } from "lucide-react";

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

interface DepartmentEmployeeSelectorProps {
  value: DepartmentEmployeeSelection[];
  onChange: (selection: DepartmentEmployeeSelection[]) => void;
  disabled?: boolean;
}

const DepartmentEmployeeSelector = ({ 
  value, 
  onChange, 
  disabled = false 
}: DepartmentEmployeeSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-selector'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-selector'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name');
      
      if (error) throw error;
      return (data || []).map(emp => ({
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`
      }));
    }
  });

  // Filter items based on search term
  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addSelection = (item: DepartmentEmployeeSelection) => {
    const exists = value.some(v => v.type === item.type && v.id === item.id);
    if (!exists) {
      onChange([...value, item]);
    }
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeSelection = (item: DepartmentEmployeeSelection) => {
    onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
  };

  return (
    <div className="space-y-2">
      {/* Selected items */}
      <div className="flex flex-wrap gap-1 min-h-[2rem]">
        {value.map((item) => (
          <Badge
            key={`${item.type}-${item.id}`}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {item.type === "department" ? <Building className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            <span className="text-xs">{item.name}</span>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeSelection(item)}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </Badge>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Departman veya personel ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="pl-8 text-sm"
            disabled={disabled}
          />
        </div>

        {/* Dropdown */}
        {showDropdown && !disabled && (searchTerm || filteredDepartments.length > 0 || filteredEmployees.length > 0) && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
            {/* Departments */}
            {filteredDepartments.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                  Departmanlar
                </div>
                {filteredDepartments.map((dept) => (
                  <button
                    key={`dept-${dept.id}`}
                    onClick={() => addSelection({ type: "department", id: dept.id, name: dept.name })}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    disabled={value.some(v => v.type === "department" && v.id === dept.id)}
                  >
                    <Building className="w-4 h-4 text-blue-500" />
                    {dept.name}
                  </button>
                ))}
              </div>
            )}

            {/* Employees */}
            {filteredEmployees.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                  Personel
                </div>
                {filteredEmployees.map((emp) => (
                  <button
                    key={`emp-${emp.id}`}
                    onClick={() => addSelection({ type: "employee", id: emp.id, name: emp.name })}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    disabled={value.some(v => v.type === "employee" && v.id === emp.id)}
                  >
                    <Users className="w-4 h-4 text-green-500" />
                    {emp.name}
                  </button>
                ))}
              </div>
            )}

            {searchTerm && filteredDepartments.length === 0 && filteredEmployees.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                Sonuç bulunamadı
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentEmployeeSelector;
