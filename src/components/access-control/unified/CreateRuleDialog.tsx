import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/useEmployees";
import { useDevices } from "@/hooks/useDevices";
import { useDepartments } from "@/hooks/useDepartments";
import { useAccessRules } from "@/hooks/useAccessRules";
import { Loader2, ChevronRight, ChevronDown, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: any;
  onClose: () => void;
}

const CreateRuleDialog = ({ open, onOpenChange, editingRule, onClose }: CreateRuleDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    selected_employees: [] as string[],
    selected_devices: [] as string[],
    selected_departments: [] as string[],
    start_time: '',
    end_time: '',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as string[],
  });

  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(new Set());

  const { employees } = useEmployees();
  const { devices } = useDevices();
  const { departments } = useDepartments();
  const { createRule, isCreating, updateRule, isUpdating } = useAccessRules();

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (open) {
      if (editingRule) {
        // Populate form with editing rule data
        const employeeIds = editingRule.rule_employees?.map((re: any) => re.employees?.id?.toString()).filter(Boolean) || 
                           (editingRule.employee_id ? [editingRule.employee_id.toString()] : []);
        const deviceIds = editingRule.rule_devices?.map((rd: any) => rd.devices?.id?.toString()).filter(Boolean) || 
                         (editingRule.device_id ? [editingRule.device_id.toString()] : []);

        console.log('Editing rule - setting employee IDs:', employeeIds);
        setFormData({
          name: editingRule.name || '',
          description: editingRule.description || '',
          selected_employees: employeeIds,
          selected_devices: deviceIds,
          selected_departments: [],
          start_time: editingRule.start_time || '',
          end_time: editingRule.end_time || '',
          days: editingRule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        });
      } else {
        // Reset form for new rule
        console.log('Resetting form for new rule');
        setFormData({
          name: '',
          description: '',
          selected_employees: [],
          selected_devices: [],
          selected_departments: [],
          start_time: '',
          end_time: '',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        });
      }
    }
  }, [open, editingRule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== FORM SUBMIT ===');
    console.log('Form data being submitted:', formData);
    console.log('Selected employees count:', formData.selected_employees.length);
    console.log('Selected employees array:', formData.selected_employees);
    console.log('Selected devices count:', formData.selected_devices.length);
    
    if (formData.selected_employees.length === 0) {
      console.error('NO EMPLOYEES SELECTED!');
      alert('Lütfen en az bir çalışan seçin.');
      return;
    }
    
    if (formData.selected_devices.length === 0) {
      console.error('NO DEVICES SELECTED!');
      alert('Lütfen en az bir cihaz seçin.');
      return;
    }
    
    if (editingRule) {
      updateRule({
        id: editingRule.id,
        ruleData: formData
      });
    } else {
      createRule(formData);
    }
    
    onClose();
  };

  const handleEmployeeChange = (employeeId: string, checked: boolean) => {
    console.log('=== EMPLOYEE CHANGE ===');
    console.log('Employee ID:', employeeId, 'Checked:', checked);
    
    setFormData(prev => {
      const newEmployees = checked 
        ? [...prev.selected_employees, employeeId]
        : prev.selected_employees.filter(id => id !== employeeId);
      
      console.log('Previous employees:', prev.selected_employees);
      console.log('New employees:', newEmployees);
      
      return {
        ...prev,
        selected_employees: newEmployees
      };
    });
  };

  const handleDepartmentChange = (departmentId: string, checked: boolean) => {
    console.log('=== DEPARTMENT CHANGE ===');
    console.log('Department ID:', departmentId, 'Checked:', checked);
    
    const departmentEmployees = getEmployeesForDepartment(parseInt(departmentId));
    const employeeIds = departmentEmployees.map(emp => emp.id.toString());
    
    console.log('Department employees:', departmentEmployees.map(emp => `${emp.id}: ${emp.first_name} ${emp.last_name}`));
    console.log('Employee IDs to toggle:', employeeIds);
    
    setFormData(prev => {
      const newDepartments = checked 
        ? [...prev.selected_departments, departmentId]
        : prev.selected_departments.filter(id => id !== departmentId);
      
      const newEmployees = checked
        ? [...new Set([...prev.selected_employees, ...employeeIds])]
        : prev.selected_employees.filter(id => !employeeIds.includes(id));
      
      console.log('Previous departments:', prev.selected_departments);
      console.log('New departments:', newDepartments);
      console.log('Previous employees:', prev.selected_employees);
      console.log('New employees:', newEmployees);
      
      return {
        ...prev,
        selected_departments: newDepartments,
        selected_employees: newEmployees
      };
    });
  };

  const handleDeviceChange = (deviceId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selected_devices: checked 
        ? [...prev.selected_devices, deviceId]
        : prev.selected_devices.filter(id => id !== deviceId)
    }));
  };

  const handleDayChange = (day: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      days: checked 
        ? [...prev.days, day]
        : prev.days.filter(d => d !== day)
    }));
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

  const getEmployeesForDepartment = (departmentId: number) => {
    return employees.filter(emp => emp.department_id === departmentId);
  };

  const isDepartmentSelected = (departmentId: number) => {
    return formData.selected_departments.includes(departmentId.toString());
  };

  const isDepartmentPartiallySelected = (departmentId: number) => {
    const departmentEmployees = getEmployeesForDepartment(departmentId);
    const selectedEmployeeIds = formData.selected_employees;
    const departmentEmployeeIds = departmentEmployees.map(emp => emp.id.toString());
    
    const selectedCount = departmentEmployeeIds.filter(id => selectedEmployeeIds.includes(id)).length;
    return selectedCount > 0 && selectedCount < departmentEmployeeIds.length;
  };

  const DepartmentCheckbox = ({ departmentId }: { departmentId: number }) => {
    const checkboxRef = useRef<HTMLButtonElement>(null);
    const isSelected = isDepartmentSelected(departmentId);
    const isPartiallySelected = isDepartmentPartiallySelected(departmentId);

    console.log(`Department ${departmentId} - Selected: ${isSelected}, Partially: ${isPartiallySelected}`);

    useEffect(() => {
      if (checkboxRef.current) {
        const element = checkboxRef.current.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (element) {
          element.indeterminate = isPartiallySelected && !isSelected;
        }
      }
    }, [isPartiallySelected, isSelected]);

    return (
      <Checkbox
        ref={checkboxRef}
        id={`dept-${departmentId}`}
        checked={isSelected}
        onCheckedChange={(checked) => {
          console.log(`Department checkbox ${departmentId} changed to:`, checked);
          handleDepartmentChange(departmentId.toString(), checked as boolean);
        }}
      />
    );
  };

  const renderDepartmentTree = (parentId: number | null = null, level: number = 0) => {
    const children = departments.filter(dept => dept.parent_id === parentId);
    
    if (!children.length) return null;

    return children.map(department => {
      const hasChildren = departments.some(dept => dept.parent_id === department.id);
      const departmentEmployees = getEmployeesForDepartment(department.id);
      const isExpanded = expandedDepartments.has(department.id);
      
      return (
        <div key={department.id} className="space-y-1">
          <div 
            className="flex items-center space-x-2"
            style={{ paddingLeft: `${level * 16}px` }}
          >
            <Button
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
            
            <DepartmentCheckbox departmentId={department.id} />
            
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
              {/* Departman çalışanları */}
              {departmentEmployees.map(employee => (
                <div 
                  key={employee.id}
                  className="flex items-center space-x-2"
                  style={{ paddingLeft: `${(level + 1) * 16 + 20}px` }}
                >
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={formData.selected_employees.includes(employee.id.toString())}
                    onCheckedChange={(checked) => 
                      handleEmployeeChange(employee.id.toString(), checked as boolean)
                    }
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
              
              {/* Alt departmanlar */}
              {hasChildren && renderDepartmentTree(department.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Departmanı olmayan çalışanlar
  const getEmployeesWithoutDepartment = () => {
    return employees.filter(emp => !emp.department_id);
  };

  const weekDays = [
    { value: 'Monday', label: 'Pazartesi' },
    { value: 'Tuesday', label: 'Salı' },
    { value: 'Wednesday', label: 'Çarşamba' },
    { value: 'Thursday', label: 'Perşembe' },
    { value: 'Friday', label: 'Cuma' },
    { value: 'Saturday', label: 'Cumartesi' },
    { value: 'Sunday', label: 'Pazar' },
  ];

  const orphanEmployees = getEmployeesWithoutDepartment();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? 'Erişim Kuralını Düzenle' : 'Yeni Erişim Kuralı'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Debug bilgileri göster */}
          <div className="bg-gray-100 p-2 rounded text-xs">
            <div>Seçili çalışan sayısı: {formData.selected_employees.length}</div>
            <div>Seçili cihaz sayısı: {formData.selected_devices.length}</div>
            {formData.selected_employees.length > 0 && (
              <div>Seçili çalışanlar: {formData.selected_employees.join(', ')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Kural Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Erişim kuralı adı"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Kural açıklaması (opsiyonel)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Çalışanlar (Departmanlar)</Label>
              <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-1">
                {renderDepartmentTree()}
                
                {/* Departmanı olmayan çalışanlar */}
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
                            console.log(`Orphan employee ${employee.id} changed to:`, checked);
                            handleEmployeeChange(employee.id.toString(), checked as boolean);
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

            <div className="space-y-3">
              <Label>Cihazlar</Label>
              <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`device-${device.id}`}
                      checked={formData.selected_devices.includes(device.id.toString())}
                      onCheckedChange={(checked) => 
                        handleDeviceChange(device.id.toString(), checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`device-${device.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {device.name} ({device.location})
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Başlangıç Saati</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Bitiş Saati</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Günler</Label>
            <div className="grid grid-cols-4 gap-2">
              {weekDays.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day.value}`}
                    checked={formData.days.includes(day.value)}
                    onCheckedChange={(checked) => 
                      handleDayChange(day.value, checked as boolean)
                    }
                  />
                  <Label 
                    htmlFor={`day-${day.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingRule ? 'Güncelleniyor...' : 'Oluşturuluyor...'}
                </>
              ) : (
                editingRule ? 'Güncelle' : 'Oluştur'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRuleDialog;
