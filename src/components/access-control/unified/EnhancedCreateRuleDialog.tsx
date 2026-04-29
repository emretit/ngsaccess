
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useEmployees } from "@/hooks/useEmployees";
import { useDevices } from "@/hooks/useDevices";
import { useDepartments } from "@/hooks/useDepartments";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { useAccessRules } from "@/hooks/useAccessRules";
import { useLocationUtils } from "@/hooks/useLocationUtils";
import { Loader2, Users, Building2, MapPin, Clock, Shield, AlertTriangle } from "lucide-react";

interface EnhancedCreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: any;
  onClose: () => void;
}

const EnhancedCreateRuleDialog = ({ open, onOpenChange, editingRule, onClose }: EnhancedCreateRuleDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetType: 'individual' as 'all' | 'department' | 'position' | 'individual',
    selectedEmployees: [] as string[],
    selectedDevices: [] as string[],
    selectedPositions: [] as string[],
    selectedZones: [] as string[],
    selectedDoors: [] as string[],
    startTime: '',
    endTime: '',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as string[],
    accessDirection: 'both' as 'entry' | 'exit' | 'both',
    priority: 100,
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [conflicts, setConflicts] = useState<any[]>([]);

  const { employees } = useEmployees();
  const { devices } = useDevices();
  const { departments } = useDepartments();
  const { zones, doors } = useZonesAndDoors();
  const { createAccessRule, isCreating, updateAccessRule, isUpdating } = useAccessRules();
  const { getDeviceLocationDisplay } = useLocationUtils();

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (open) {
      if (editingRule) {
        setFormData({
          name: editingRule.name || '',
          description: editingRule.description || '',
          targetType: editingRule.targetType || 'individual',
          selectedEmployees: editingRule.groupMembers?.map((gm: any) => gm.employees?._id).filter(Boolean) || [],
          selectedDevices: editingRule.groupDevices?.map((gd: any) => gd.devices?._id).filter(Boolean) || [],
          selectedPositions: [],
          selectedZones: [],
          selectedDoors: [],
          startTime: editingRule.startTime || '',
          endTime: editingRule.endTime || '',
          days: editingRule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          accessDirection: editingRule.accessDirection || 'both',
          priority: editingRule.priority || 100,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          targetType: 'individual',
          selectedEmployees: [],
          selectedDevices: [],
          selectedPositions: [],
          selectedZones: [],
          selectedDoors: [],
          startTime: '',
          endTime: '',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          accessDirection: 'both',
          priority: 100,
        });
      }
    }
  }, [open, editingRule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== ENHANCED FORM SUBMIT ===');
    console.log('Form data being submitted:', formData);
    
    // Enhanced validation
    if (!formData.name.trim()) {
      alert('Lütfen kural adı girin.');
      return;
    }

    if (formData.targetType === 'individual' && formData.selectedEmployees.length === 0) {
      alert('Lütfen en az bir çalışan seçin.');
      return;
    }

    if (formData.selectedDevices.length === 0 && formData.selectedZones.length === 0 && formData.selectedDoors.length === 0) {
      alert('Lütfen en az bir cihaz, bölge veya kapı seçin.');
      return;
    }

    const ruleData = {
      name: formData.name,
      description: formData.description,
      targetType: formData.targetType,
      startTime: formData.startTime,
      endTime: formData.endTime,
      days: formData.days,
      accessDirection: formData.accessDirection,
      priority: formData.priority,
    };

    if (editingRule) {
      updateAccessRule.mutate({
        id: editingRule._id,
        updates: ruleData
      });
    } else {
      createAccessRule.mutate(ruleData);
    }
    
    onClose();
  };

  const handleTargetTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      targetType: value as 'all' | 'department' | 'position' | 'individual',
      selectedEmployees: value === 'all' ? [] : prev.selectedEmployees
    }));
  };

  const renderTargetSelection = () => {
    switch (formData.targetType) {
      case 'individual':
        return (
          <div className="space-y-3">
            <Label>Çalışanlar</Label>
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {employees.map((employee) => (
                <div key={employee._id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`employee-${employee._id}`}
                    checked={formData.selectedEmployees.includes(employee._id)}
                    onCheckedChange={(checked) => {
                      setFormData(prev => ({
                        ...prev,
                        selectedEmployees: checked
                          ? [...prev.selectedEmployees, employee._id]
                          : prev.selectedEmployees.filter(id => id !== employee._id)
                      }));
                    }}
                  />
                  <Users className="h-4 w-4 text-gray-500" />
                  <Label htmlFor={`employee-${employee._id}`} className="text-sm cursor-pointer">
                    {employee.firstName} {employee.lastName}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'department':
        return (
          <div className="space-y-3">
            <Label>Departmanlar</Label>
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {departments.map((department: any) => (
                <div key={department._id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dept-${department._id}`}
                    checked={formData.selectedEmployees.includes(department._id)}
                    onCheckedChange={(checked) => {
                      // For department rules, we store department employees
                      const deptEmployees = employees.filter(emp => emp.departmentId === department._id);
                      const employeeIds = deptEmployees.map(emp => String(emp._id));

                      setFormData(prev => ({
                        ...prev,
                        selectedEmployees: checked
                          ? [...new Set([...prev.selectedEmployees, ...employeeIds])]
                          : prev.selectedEmployees.filter(id => !employeeIds.includes(id))
                      }));
                    }}
                  />
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <Label htmlFor={`dept-${department._id}`} className="text-sm cursor-pointer">
                    {department.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'all':
        return (
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Tüm Çalışanlar</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Bu kural tüm çalışanlar için geçerli olacaktır.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderAccessPointSelection = () => (
    <Tabs defaultValue="devices" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="devices">Cihazlar</TabsTrigger>
        <TabsTrigger value="zones">Bölgeler</TabsTrigger>
        <TabsTrigger value="doors">Kapılar</TabsTrigger>
      </TabsList>
      
      <TabsContent value="devices" className="space-y-3">
        <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
          {devices.map((device) => (
            <div key={device._id} className="flex items-center space-x-2">
              <Checkbox
                id={`device-${device._id}`}
                checked={formData.selectedDevices.includes(device._id)}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    selectedDevices: checked
                      ? [...prev.selectedDevices, device._id]
                      : prev.selectedDevices.filter(id => id !== device._id)
                  }))
                }
              />
              <MapPin className="h-4 w-4 text-green-500" />
              <Label htmlFor={`device-${device._id}`} className="text-sm cursor-pointer">
                {device.name} ({getDeviceLocationDisplay(device)})
              </Label>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="zones" className="space-y-3">
        <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
          {zones.map((zone: any) => (
            <div key={zone._id} className="flex items-center space-x-2">
              <Checkbox
                id={`zone-${zone._id}`}
                checked={formData.selectedZones.includes(zone._id)}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    selectedZones: checked
                      ? [...prev.selectedZones, zone._id]
                      : prev.selectedZones.filter(id => id !== zone._id)
                  }))
                }
              />
              <Building2 className="h-4 w-4 text-purple-500" />
              <Label htmlFor={`zone-${zone._id}`} className="text-sm cursor-pointer">
                {zone.name}
              </Label>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="doors" className="space-y-3">
        <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
          {doors.map((door: any) => (
            <div key={door._id} className="flex items-center space-x-2">
              <Checkbox
                id={`door-${door._id}`}
                checked={formData.selectedDoors.includes(door._id)}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    selectedDoors: checked
                      ? [...prev.selectedDoors, door._id]
                      : prev.selectedDoors.filter(id => id !== door._id)
                  }))
                }
              />
              <MapPin className="h-4 w-4 text-orange-500" />
              <Label htmlFor={`door-${door._id}`} className="text-sm cursor-pointer">
                {door.name}
              </Label>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );

  const weekDays = [
    { value: 'Monday', label: 'Pazartesi' },
    { value: 'Tuesday', label: 'Salı' },
    { value: 'Wednesday', label: 'Çarşamba' },
    { value: 'Thursday', label: 'Perşembe' },
    { value: 'Friday', label: 'Cuma' },
    { value: 'Saturday', label: 'Cumartesi' },
    { value: 'Sunday', label: 'Pazar' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? 'Gelişmiş Erişim Kuralını Düzenle' : 'Yeni Gelişmiş Erişim Kuralı'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
            <TabsTrigger value="targets">Hedefler</TabsTrigger>
            <TabsTrigger value="access">Erişim Noktaları</TabsTrigger>
            <TabsTrigger value="schedule">Zaman Ayarları</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-6">
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5" />
                    <span>Kural Detayları</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Kural Adı *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Erişim kuralı adı"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Öncelik</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
                        placeholder="100"
                        min="1"
                        max="1000"
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

                  <div className="space-y-2">
                    <Label htmlFor="target_type">Hedef Türü</Label>
                    <Select value={formData.targetType} onValueChange={handleTargetTypeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Hedef türünü seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Bireysel Çalışan</SelectItem>
                        <SelectItem value="department">Departman</SelectItem>
                        <SelectItem value="all">Tüm Çalışanlar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="access_direction">Erişim Yönü</Label>
                    <Select value={formData.accessDirection} onValueChange={(value) =>
                      setFormData(prev => ({ ...prev, accessDirection: value as 'entry' | 'exit' | 'both' }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Erişim yönünü seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Giriş & Çıkış</SelectItem>
                        <SelectItem value="entry">Sadece Giriş</SelectItem>
                        <SelectItem value="exit">Sadece Çıkış</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="targets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Hedef Seçimi</span>
                  </CardTitle>
                  <CardDescription>
                    Bu kural hangi çalışanlar için geçerli olacak?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTargetSelection()}
                  
                  {formData.selectedEmployees.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary">
                          {formData.selectedEmployees.length} çalışan seçildi
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Erişim Noktaları</span>
                  </CardTitle>
                  <CardDescription>
                    Bu kural hangi cihaz, bölge veya kapılar için geçerli olacak?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderAccessPointSelection()}
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    {formData.selectedDevices.length > 0 && (
                      <Badge variant="outline">
                        {formData.selectedDevices.length} cihaz
                      </Badge>
                    )}
                    {formData.selectedZones.length > 0 && (
                      <Badge variant="outline">
                        {formData.selectedZones.length} bölge
                      </Badge>
                    )}
                    {formData.selectedDoors.length > 0 && (
                      <Badge variant="outline">
                        {formData.selectedDoors.length} kapı
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Zaman Ayarları</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_time">Başlangıç Saati</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_time">Bitiş Saati</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
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
                              setFormData(prev => ({
                                ...prev,
                                days: checked 
                                  ? [...prev.days, day.value]
                                  : prev.days.filter(d => d !== day.value)
                              }))
                            }
                          />
                          <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {conflicts.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="font-medium text-red-700">Çakışma Tespit Edildi</span>
                      </div>
                      <div className="space-y-2">
                        {conflicts.map((conflict, index) => (
                          <div key={index} className="text-sm text-red-600">
                            {conflict.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                İptal
              </Button>
              <Button 
                type="submit" 
                disabled={isCreating || isUpdating}
                className="bg-primary hover:bg-primary/90"
              >
                {isCreating || isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingRule ? 'Güncelleniyor...' : 'Oluşturuluyor...'}
                  </>
                ) : (
                  editingRule ? 'Kuralı Güncelle' : 'Kural Oluştur'
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedCreateRuleDialog;
