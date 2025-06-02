import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccessRules } from "@/hooks/useAccessRules";
import { useEmployees } from "@/hooks/useEmployees";
import { useDevices } from "@/hooks/useDevices";
import { useDepartments } from "@/hooks/useDepartments";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateRuleDialog = ({ open, onOpenChange }: CreateRuleDialogProps) => {
  const { createRule, isCreating } = useAccessRules();
  const { employees = [] } = useEmployees();
  const { devices = [] } = useDevices();
  const { departments = [] } = useDepartments();
  const { zones = [] } = useZonesAndDoors();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    selected_employees: [] as string[],
    selected_devices: [] as string[],
    start_time: "",
    end_time: "",
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as string[],
  });

  const weekDays = [
    { value: 'Monday', label: 'Pazartesi' },
    { value: 'Tuesday', label: 'Salı' },
    { value: 'Wednesday', label: 'Çarşamba' },
    { value: 'Thursday', label: 'Perşembe' },
    { value: 'Friday', label: 'Cuma' },
    { value: 'Saturday', label: 'Cumartesi' },
    { value: 'Sunday', label: 'Pazar' },
  ];

  // Çalışanları departmanlarına göre grupla
  const groupedEmployees = departments.reduce((acc: any, department: any) => {
    const deptEmployees = employees.filter((emp: any) => emp.department_id === department.id);
    if (deptEmployees.length > 0) {
      acc[department.id] = {
        name: department.name,
        employees: deptEmployees
      };
    }
    return acc;
  }, {});

  // Departmanı olmayan çalışanlar
  const unassignedEmployees = employees.filter((emp: any) => !emp.department_id);

  // Cihazları bölgelerine göre grupla
  const groupedDevices = zones.reduce((acc: any, zone: any) => {
    const zoneDevices = devices.filter((device: any) => device.zone_id === zone.id);
    if (zoneDevices.length > 0) {
      acc[zone.id] = {
        name: zone.name,
        devices: zoneDevices
      };
    }
    return acc;
  }, {});

  // Bölgesi olmayan cihazlar
  const unassignedDevices = devices.filter((device: any) => !device.zone_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createRule(formData);
    onOpenChange(false);
    
    // Form'u temizle
    setFormData({
      name: "",
      description: "",
      selected_employees: [],
      selected_devices: [],
      start_time: "",
      end_time: "",
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    });
  };

  const handleDayToggle = (day: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        days: [...prev.days, day]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        days: prev.days.filter(d => d !== day)
      }));
    }
  };

  const handleEmployeeToggle = (employeeId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        selected_employees: [...prev.selected_employees, employeeId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selected_employees: prev.selected_employees.filter(id => id !== employeeId)
      }));
    }
  };

  const handleDepartmentToggle = (departmentId: number, checked: boolean) => {
    const deptEmployeeIds = groupedEmployees[departmentId]?.employees.map((emp: any) => emp.id.toString()) || [];
    
    if (checked) {
      // Departmandaki tüm çalışanları seç
      setFormData(prev => ({
        ...prev,
        selected_employees: [...new Set([...prev.selected_employees, ...deptEmployeeIds])]
      }));
    } else {
      // Departmandaki tüm çalışanları kaldır
      setFormData(prev => ({
        ...prev,
        selected_employees: prev.selected_employees.filter(id => !deptEmployeeIds.includes(id))
      }));
    }
  };

  const handleDeviceToggle = (deviceId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        selected_devices: [...prev.selected_devices, deviceId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selected_devices: prev.selected_devices.filter(id => id !== deviceId)
      }));
    }
  };

  const handleZoneToggle = (zoneId: number, checked: boolean) => {
    const zoneDeviceIds = groupedDevices[zoneId]?.devices.map((device: any) => device.id.toString()) || [];
    
    if (checked) {
      // Bölgedeki tüm cihazları seç
      setFormData(prev => ({
        ...prev,
        selected_devices: [...new Set([...prev.selected_devices, ...zoneDeviceIds])]
      }));
    } else {
      // Bölgedeki tüm cihazları kaldır
      setFormData(prev => ({
        ...prev,
        selected_devices: prev.selected_devices.filter(id => !zoneDeviceIds.includes(id))
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Erişim Kuralı</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Kural Adı *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Çalışanlar ({formData.selected_employees.length} seçili)</Label>
              <div className="border rounded-md p-4 max-h-64 overflow-y-auto bg-background">
                {/* Tüm çalışanlar seçeneği */}
                <div className="flex items-center space-x-2 mb-3 pb-2 border-b">
                  <Checkbox
                    id="all-employees"
                    checked={formData.selected_employees.length === employees.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({
                          ...prev,
                          selected_employees: employees.map((emp: any) => emp.id.toString())
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          selected_employees: []
                        }));
                      }
                    }}
                  />
                  <Label htmlFor="all-employees" className="font-semibold">
                    Tüm Çalışanlar
                  </Label>
                </div>

                {/* Departmanlı çalışanlar */}
                {Object.entries(groupedEmployees).map(([deptId, deptData]: [string, any]) => {
                  const deptEmployeeIds = deptData.employees.map((emp: any) => emp.id.toString());
                  const isAllSelected = deptEmployeeIds.every((id: string) => 
                    formData.selected_employees.includes(id)
                  );
                  const isSomeSelected = deptEmployeeIds.some((id: string) => 
                    formData.selected_employees.includes(id)
                  );

                  return (
                    <div key={deptId} className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          id={`dept-${deptId}`}
                          checked={isAllSelected}
                          onCheckedChange={(checked) => handleDepartmentToggle(parseInt(deptId), checked as boolean)}
                          className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-orange-500" : ""}
                        />
                        <Label htmlFor={`dept-${deptId}`} className="font-medium text-blue-700">
                          📁 {deptData.name}
                        </Label>
                      </div>
                      <div className="ml-6 space-y-1">
                        {deptData.employees.map((employee: any) => (
                          <div key={employee.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`emp-${employee.id}`}
                              checked={formData.selected_employees.includes(employee.id.toString())}
                              onCheckedChange={(checked) => 
                                handleEmployeeToggle(employee.id.toString(), checked as boolean)
                              }
                            />
                            <Label htmlFor={`emp-${employee.id}`} className="text-sm">
                              👤 {employee.first_name} {employee.last_name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Departmanı olmayan çalışanlar */}
                {unassignedEmployees.length > 0 && (
                  <div className="mb-4">
                    <Label className="font-medium text-gray-600 mb-2 block">
                      📂 Departmanı Olmayan Çalışanlar
                    </Label>
                    <div className="ml-6 space-y-1">
                      {unassignedEmployees.map((employee: any) => (
                        <div key={employee.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`emp-${employee.id}`}
                            checked={formData.selected_employees.includes(employee.id.toString())}
                            onCheckedChange={(checked) => 
                              handleEmployeeToggle(employee.id.toString(), checked as boolean)
                            }
                          />
                          <Label htmlFor={`emp-${employee.id}`} className="text-sm">
                            👤 {employee.first_name} {employee.last_name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Cihazlar ({formData.selected_devices.length} seçili)</Label>
              <div className="border rounded-md p-4 max-h-64 overflow-y-auto bg-background">
                {/* Tüm cihazlar seçeneği */}
                <div className="flex items-center space-x-2 mb-3 pb-2 border-b">
                  <Checkbox
                    id="all-devices"
                    checked={formData.selected_devices.length === devices.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({
                          ...prev,
                          selected_devices: devices.map((device: any) => device.id.toString())
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          selected_devices: []
                        }));
                      }
                    }}
                  />
                  <Label htmlFor="all-devices" className="font-semibold">
                    Tüm Cihazlar
                  </Label>
                </div>

                {/* Bölgelerdeki cihazlar */}
                {Object.entries(groupedDevices).map(([zoneId, zoneData]: [string, any]) => {
                  const zoneDeviceIds = zoneData.devices.map((device: any) => device.id.toString());
                  const isAllSelected = zoneDeviceIds.every((id: string) => 
                    formData.selected_devices.includes(id)
                  );
                  const isSomeSelected = zoneDeviceIds.some((id: string) => 
                    formData.selected_devices.includes(id)
                  );

                  return (
                    <div key={zoneId} className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          id={`zone-${zoneId}`}
                          checked={isAllSelected}
                          onCheckedChange={(checked) => handleZoneToggle(parseInt(zoneId), checked as boolean)}
                          className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-orange-500" : ""}
                        />
                        <Label htmlFor={`zone-${zoneId}`} className="font-medium text-green-700">
                          🏢 {zoneData.name}
                        </Label>
                      </div>
                      <div className="ml-6 space-y-1">
                        {zoneData.devices.map((device: any) => (
                          <div key={device.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`device-${device.id}`}
                              checked={formData.selected_devices.includes(device.id.toString())}
                              onCheckedChange={(checked) => 
                                handleDeviceToggle(device.id.toString(), checked as boolean)
                              }
                            />
                            <Label htmlFor={`device-${device.id}`} className="text-sm">
                              📱 {device.name} ({device.location})
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Bölgesi olmayan cihazlar */}
                {unassignedDevices.length > 0 && (
                  <div className="mb-4">
                    <Label className="font-medium text-gray-600 mb-2 block">
                      📦 Bölgesi Olmayan Cihazlar
                    </Label>
                    <div className="ml-6 space-y-1">
                      {unassignedDevices.map((device: any) => (
                        <div key={device.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`device-${device.id}`}
                            checked={formData.selected_devices.includes(device.id.toString())}
                            onCheckedChange={(checked) => 
                              handleDeviceToggle(device.id.toString(), checked as boolean)
                            }
                          />
                          <Label htmlFor={`device-${device.id}`} className="text-sm">
                            📱 {device.name} ({device.location})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Başlangıç Saati</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="end_time">Bitiş Saati</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>Günler</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {weekDays.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={day.value}
                    checked={formData.days.includes(day.value)}
                    onCheckedChange={(checked) => handleDayToggle(day.value, checked as boolean)}
                  />
                  <Label htmlFor={day.value}>{day.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRuleDialog;
