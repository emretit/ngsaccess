
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, AlertCircle } from "lucide-react";
import { useShifts } from "@/hooks/useShiftBasedAccessRules";
import { useAccessRuleMutations } from "@/hooks/access-rules/useAccessRuleMutations";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Loader2 } from "lucide-react";

interface ShiftBasedCreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: any;
  onClose: () => void;
}

const ShiftBasedCreateRuleDialog = ({ 
  open, 
  onOpenChange, 
  editingRule, 
  onClose 
}: ShiftBasedCreateRuleDialogProps) => {
  const { projectIds } = useProjectAccess();
  const { data: shifts = [] } = useShifts(projectIds?.[0]);
  const { createAccessRule, updateAccessRule } = useAccessRuleMutations();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_type: 'individual' as 'all' | 'department' | 'position' | 'individual',
    access_direction: 'both' as 'entry' | 'exit' | 'both',
    priority: 100,
    is_shift_based: false,
    shift_id: '',
    start_time: '',
    end_time: '',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as string[],
  });

  const [isLoading, setIsLoading] = useState(false);

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (open) {
      if (editingRule) {
        setFormData({
          name: editingRule.name || '',
          description: editingRule.description || '',
          target_type: editingRule.target_type || 'individual',
          access_direction: editingRule.access_direction || 'both',
          priority: editingRule.priority || 100,
          is_shift_based: editingRule.is_shift_based || false,
          shift_id: editingRule.shift_id?.toString() || '',
          start_time: editingRule.start_time || '',
          end_time: editingRule.end_time || '',
          days: editingRule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        });
      } else {
        setFormData({
          name: '',
          description: '',
          target_type: 'individual',
          access_direction: 'both',
          priority: 100,
          is_shift_based: false,
          shift_id: '',
          start_time: '',
          end_time: '',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        });
      }
    }
  }, [open, editingRule]);

  const selectedShift = shifts.find(shift => shift.id.toString() === formData.shift_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const ruleData = {
        name: formData.name,
        description: formData.description,
        target_type: formData.target_type,
        access_direction: formData.access_direction,
        priority: formData.priority,
        start_time: formData.is_shift_based ? null : formData.start_time,
        end_time: formData.is_shift_based ? null : formData.end_time,
        days: formData.days,
        project_id: projectIds?.[0],
        // Shift bilgisini metadata olarak ekle
        ...(formData.is_shift_based && { shift_id: parseInt(formData.shift_id) })
      };
      
      if (editingRule) {
        await updateAccessRule.mutateAsync({
          id: editingRule.id,
          updates: ruleData
        });
      } else {
        await createAccessRule.mutateAsync(ruleData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving rule:', error);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {editingRule ? 'Erişim Kuralını Düzenle' : 'Yeni Erişim Kuralı'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Temel Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle>Temel Bilgiler</CardTitle>
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
            </CardContent>
          </Card>

          {/* Vardiya Ayarları */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Zaman Ayarları
              </CardTitle>
              <CardDescription>
                Vardiya bazlı erişim kontrolü veya manuel zaman ayarları
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_shift_based"
                  checked={formData.is_shift_based}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_shift_based: checked }))
                  }
                />
                <Label htmlFor="is_shift_based">Vardiya bazlı erişim kontrolü</Label>
              </div>

              {formData.is_shift_based ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vardiya Seçin</Label>
                    <Select 
                      value={formData.shift_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, shift_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vardiya seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{shift.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {shift.start_time} - {shift.end_time}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedShift && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Seçili Vardiya Bilgileri</span>
                      </div>
                      <div className="text-sm text-blue-800">
                        <p><strong>Vardiya:</strong> {selectedShift.name}</p>
                        <p><strong>Çalışma Saatleri:</strong> {selectedShift.start_time} - {selectedShift.end_time}</p>
                        {selectedShift.break_start && selectedShift.break_end && (
                          <p><strong>Mola:</strong> {selectedShift.break_start} - {selectedShift.break_end}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
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
              )}

              <div className="space-y-3">
                <Label>Aktif Günler</Label>
                <div className="grid grid-cols-4 gap-2">
                  {weekDays.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`day-${day.value}`}
                        checked={formData.days.includes(day.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              days: [...prev.days, day.value]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              days: prev.days.filter(d => d !== day.value)
                            }));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diğer Ayarlar */}
          <Card>
            <CardHeader>
              <CardTitle>Erişim Ayarları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hedef Türü</Label>
                  <Select 
                    value={formData.target_type} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, target_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Bireysel Çalışan</SelectItem>
                      <SelectItem value="department">Departman</SelectItem>
                      <SelectItem value="all">Tüm Çalışanlar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Erişim Yönü</Label>
                  <Select 
                    value={formData.access_direction} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, access_direction: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Giriş & Çıkış</SelectItem>
                      <SelectItem value="entry">Sadece Giriş</SelectItem>
                      <SelectItem value="exit">Sadece Çıkış</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
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
      </DialogContent>
    </Dialog>
  );
};

export default ShiftBasedCreateRuleDialog;
