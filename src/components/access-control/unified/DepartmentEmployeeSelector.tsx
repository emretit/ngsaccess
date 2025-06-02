
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, Users, Building, ChevronDown } from "lucide-react";

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

  const isSelected = (item: DepartmentEmployeeSelection) => {
    return value.some(v => v.type === item.type && v.id === item.id);
  };

  const toggleSelection = (item: DepartmentEmployeeSelection) => {
    const exists = value.some(v => v.type === item.type && v.id === item.id);
    if (exists) {
      onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
    } else {
      onChange([...value, item]);
    }
  };

  const removeSelection = (item: DepartmentEmployeeSelection) => {
    onChange(value.filter(v => !(v.type === item.type && v.id === item.id)));
  };

  const selectAllDepartments = () => {
    const allDepts = filteredDepartments.map(dept => ({
      type: "department" as const,
      id: dept.id,
      name: dept.name
    }));
    const newSelections = allDepts.filter(dept => !isSelected(dept));
    onChange([...value, ...newSelections]);
  };

  const selectAllEmployees = () => {
    const allEmps = filteredEmployees.map(emp => ({
      type: "employee" as const,
      id: emp.id,
      name: emp.name
    }));
    const newSelections = allEmps.filter(emp => !isSelected(emp));
    onChange([...value, ...newSelections]);
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

      {/* Dropdown trigger */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled}
        >
          <span className="text-sm text-muted-foreground">
            Departman veya personel seçin...
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* Dropdown content */}
        {showDropdown && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-hidden">
            {/* Search input */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-auto">
              {/* Departments section */}
              {filteredDepartments.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b flex justify-between items-center">
                    <span>Departmanlar</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={selectAllDepartments}
                    >
                      Tümünü Seç
                    </Button>
                  </div>
                  {filteredDepartments.map((dept) => {
                    const item = { type: "department" as const, id: dept.id, name: dept.name };
                    return (
                      <div
                        key={`dept-${dept.id}`}
                        className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSelection(item)}
                      >
                        <Checkbox
                          checked={isSelected(item)}
                          onChange={() => {}}
                        />
                        <Building className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">{dept.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Employees section */}
              {filteredEmployees.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b flex justify-between items-center">
                    <span>Personel</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={selectAllEmployees}
                    >
                      Tümünü Seç
                    </Button>
                  </div>
                  {filteredEmployees.map((emp) => {
                    const item = { type: "employee" as const, id: emp.id, name: emp.name };
                    return (
                      <div
                        key={`emp-${emp.id}`}
                        className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSelection(item)}
                      >
                        <Checkbox
                          checked={isSelected(item)}
                          onChange={() => {}}
                        />
                        <Users className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{emp.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchTerm && filteredDepartments.length === 0 && filteredEmployees.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Sonuç bulunamadı
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="p-2 border-t bg-gray-50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowDropdown(false)}
              >
                Kapat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentEmployeeSelector;
