
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronDown, Users, User } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";

interface DepartmentTreeProps {
  formData: {
    selected_employees: string[];
    selected_departments: string[];
  };
  setFormData: (updater: (prev: any) => any) => void;
}

export const DepartmentTree = ({ formData, setFormData }: DepartmentTreeProps) => {
  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(new Set());
  const { employees } = useEmployees();
  const { departments } = useDepartments();

  const handleEmployeeChange = (employeeId: string, checked: boolean) => {
    setFormData(prev => {
      const newEmployees = checked 
        ? [...prev.selected_employees, employeeId]
        : prev.selected_employees.filter(id => id !== employeeId);
      
      return {
        ...prev,
        selected_employees: newEmployees
      };
    });
  };

  const getEmployeesForDepartment = (departmentId: number) => {
    return employees.filter(emp => emp.department_id === departmentId);
  };

  const handleDepartmentChange = (departmentId: string, checked: boolean) => {
    const departmentEmployees = getEmployeesForDepartment(parseInt(departmentId));
    const employeeIds = departmentEmployees.map(emp => emp.id.toString());
    
    setFormData(prev => {
      const newDepartments = checked 
        ? [...prev.selected_departments, departmentId]
        : prev.selected_departments.filter(id => id !== departmentId);
      
      const newEmployees = checked
        ? [...new Set([...prev.selected_employees, ...employeeIds])]
        : prev.selected_employees.filter(id => !employeeIds.includes(id));
      
      return {
        ...prev,
        selected_departments: newDepartments,
        selected_employees: newEmployees
      };
    });
  };

  const toggleDepartmentExpansion = (departmentId: number) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  const isDepartmentSelected = (departmentId: number) => {
    return formData.selected_departments.includes(departmentId.toString());
  };

  const renderDepartmentTree = (parentId: number | null = null, level: number = 0) => {
    const children = departments.filter(dept => dept.parent_id === parentId);
    
    if (!children.length) return null;

    return children.map(department => {
      const hasChildren = departments.some(dept => dept.parent_id === department.id);
      const departmentEmployees = getEmployeesForDepartment(department.id);
      const isExpanded = expandedDepartments.has(department.id);
      const isSelected = isDepartmentSelected(department.id);
      
      return (
        <div key={`dept-${department.id}`} className="space-y-1">
          <div 
            className="flex items-center space-x-2"
            style={{ paddingLeft: `${level * 16}px` }}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleDepartmentExpansion(department.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            
            <Checkbox
              id={`dept-${department.id}`}
              checked={isSelected}
              onCheckedChange={(checked) => {
                handleDepartmentChange(department.id.toString(), Boolean(checked));
              }}
            />
            
            <Users className="h-4 w-4 text-blue-500" />
            <Label 
              htmlFor={`dept-${department.id}`}
              className="text-sm font-medium cursor-pointer flex-1"
            >
              {department.name} ({departmentEmployees.length} çalışan)
            </Label>
          </div>
          
          {isExpanded && (
            <div className="space-y-1">
              {departmentEmployees.map(employee => (
                <div 
                  key={`emp-${employee.id}`}
                  className="flex items-center space-x-2"
                  style={{ paddingLeft: `${(level + 1) * 16 + 20}px` }}
                >
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={formData.selected_employees.includes(employee.id.toString())}
                    onCheckedChange={(checked) => {
                      handleEmployeeChange(employee.id.toString(), Boolean(checked));
                    }}
                  />
                  <User className="h-3 w-3 text-gray-500" />
                  <Label 
                    htmlFor={`employee-${employee.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {employee.first_name} {employee.last_name}
                  </Label>
                </div>
              ))}
              
              {hasChildren && renderDepartmentTree(department.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const orphanEmployees = employees.filter(emp => !emp.department_id);

  return (
    <div className="space-y-3">
      <Label>Kim Erişebilecek?</Label>
      <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-1">
        {renderDepartmentTree()}
        
        {orphanEmployees.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="h-4 w-4 text-gray-500" />
              <Label className="text-sm font-medium text-gray-700">
                Departmanı Olmayan Çalışanlar ({orphanEmployees.length})
              </Label>
            </div>
            {orphanEmployees.map(employee => (
              <div key={employee.id} className="flex items-center space-x-2 ml-6">
                <Checkbox
                  id={`orphan-employee-${employee.id}`}
                  checked={formData.selected_employees.includes(employee.id.toString())}
                  onCheckedChange={(checked) => {
                    handleEmployeeChange(employee.id.toString(), Boolean(checked));
                  }}
                />
                <User className="h-3 w-3 text-gray-500" />
                <Label 
                  htmlFor={`orphan-employee-${employee.id}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {employee.first_name} {employee.last_name}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
