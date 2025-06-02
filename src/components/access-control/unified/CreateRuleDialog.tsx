
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccessRules } from "@/hooks/useAccessRules";
import { useEmployees } from "@/hooks/useEmployees";
import { useDevices } from "@/hooks/useDevices";

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateRuleDialog = ({ open, onOpenChange }: CreateRuleDialogProps) => {
  const { createRule, isCreating } = useAccessRules();
  const { data: employees = [] } = useEmployees();
  const { data: devices = [] } = useDevices();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    employee_id: "",
    device_id: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const ruleData = {
      name: formData.name,
      description: formData.description || null,
      employee_id: formData.employee_id ? parseInt(formData.employee_id) : null,
      device_id: formData.device_id ? parseInt(formData.device_id) : null,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      days: formData.days,
      is_active: true,
    };

    createRule(ruleData);
    onOpenChange(false);
    
    // Form'u temizle
    setFormData({
      name: "",
      description: "",
      employee_id: "",
      device_id: "",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
              <Label htmlFor="employee">Çalışan</Label>
              <Select 
                value={formData.employee_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Çalışan seçin (opsiyonel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tüm çalışanlar</SelectItem>
                  {employees.map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="device">Cihaz</Label>
              <Select 
                value={formData.device_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, device_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cihaz seçin (opsiyonel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tüm cihazlar</SelectItem>
                  {devices.map((device: any) => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.name} ({device.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
