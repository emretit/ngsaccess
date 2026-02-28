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
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
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

  const handleSelectAll = () => {
    const allEmployeeIds = employees.map(emp => String(emp.id));
    const allDepartmentIds = departments.map(dept => String(dept._id));
    const allSelected = allEmployeeIds.every(id => formData.selected_employees.includes(id));

    setFormData(prev => ({
      ...prev,
      selected_employees: allSelected ? [] : allEmployeeIds,
      selected_departments: allSelected ? [] : allDepartmentIds
    }));
  };

  const getEmployeesForDepartment = (departmentId: string) => {
    return employees.filter(emp => String(emp.department_id ?? '') === departmentId);
  };

  const handleDepartmentChange = (departmentId: string, checked: boolean) => {
    const departmentEmployees = getEmployeesForDepartment(departmentId);
    const employeeIds = departmentEmployees.map(emp => String(emp.id));

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

  const toggleDepartmentExpansion = (departmentId: string) => {
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

  const isDepartmentSelected = (departmentId: string) => {
    return formData.selected_departments.includes(departmentId);
  };

  const renderDepartmentTree = (parentId: string | null = null, level: number = 0) => {
    const children = departments.filter(dept => {
      const deptParentId = dept.parentId ? String(dept.parentId) : null;
      return deptParentId === parentId;
    });

    if (!children.length) return null;

    return children.map(department => {
      const deptId = String(department._id);
      const hasChildren = departments.some(dept => String(dept.parentId ?? '') === deptId);
      const departmentEmployees = getEmployeesForDepartment(deptId);
      const isExpanded = expandedDepartments.has(deptId);
      const isSelected = isDepartmentSelected(deptId);

      return (
        <div key={`dept-${deptId}`} className="space-y-1">
          <div
            className="flex items-center space-x-2"
            style={{ paddingLeft: `${level * 16}px` }}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleDepartmentExpansion(deptId)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>

            <Checkbox
              id={`dept-${deptId}`}
              checked={isSelected}
              onCheckedChange={(checked) => {
                handleDepartmentChange(deptId, Boolean(checked));
              }}
            />

            <Users className="h-4 w-4 text-blue-500" />
            <Label
              htmlFor={`dept-${deptId}`}
              className="text-sm font-medium cursor-pointer flex-1"
            >
              {department.name} ({departmentEmployees.length} çalışan)
            </Label>
          </div>

          {isExpanded && (
            <div className="space-y-1">
              {departmentEmployees.map(employee => {
                const empId = String(employee.id);
                return (
                  <div
                    key={`emp-${empId}`}
                    className="flex items-center space-x-2"
                    style={{ paddingLeft: `${(level + 1) * 16 + 20}px` }}
                  >
                    <Checkbox
                      id={`employee-${empId}`}
                      checked={formData.selected_employees.includes(empId)}
                      onCheckedChange={(checked) => {
                        handleEmployeeChange(empId, Boolean(checked));
                      }}
                    />
                    <User className="h-3 w-3 text-gray-500" />
                    <Label
                      htmlFor={`employee-${empId}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {employee.first_name} {employee.last_name}
                    </Label>
                  </div>
                );
              })}

              {hasChildren && renderDepartmentTree(deptId, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const allSelected = employees.length > 0 && employees.every(emp =>
    formData.selected_employees.includes(String(emp.id))
  );

  const orphanEmployees = employees.filter(emp => !emp.department_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Kim Erişebilecek?</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          className="text-xs"
        >
          {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
        </Button>
      </div>
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
            {orphanEmployees.map(employee => {
              const empId = String(employee.id);
              return (
                <div key={empId} className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id={`orphan-employee-${empId}`}
                    checked={formData.selected_employees.includes(empId)}
                    onCheckedChange={(checked) => {
                      handleEmployeeChange(empId, Boolean(checked));
                    }}
                  />
                  <User className="h-3 w-3 text-gray-500" />
                  <Label
                    htmlFor={`orphan-employee-${empId}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {employee.first_name} {employee.last_name}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
