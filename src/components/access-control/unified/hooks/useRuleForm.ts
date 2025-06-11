
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useAccessRules } from "@/hooks/useAccessRules";

interface RuleFormData {
  name: string;
  description: string;
  target_type: 'all' | 'department' | 'position' | 'individual';
  selected_employees: string[];
  selected_devices: string[];
  selected_zones: string[];
  selected_departments: string[];
  start_time: string;
  end_time: string;
  days: string[];
  access_direction: 'entry' | 'exit' | 'both';
  priority: number;
}

export const useRuleForm = (editingRule: any, open: boolean, onClose: () => void) => {
  const { toast } = useToast();
  const { createAccessRuleWithMembers, updateAccessRule } = useAccessRules();

  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    target_type: 'individual',
    selected_employees: [],
    selected_devices: [],
    selected_zones: [],
    selected_departments: [],
    start_time: '',
    end_time: '',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    access_direction: 'both',
    priority: 100,
  });

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (open) {
      if (editingRule) {
        const employeeIds = editingRule.group_members?.map((gm: any) => gm.employee_id?.toString()).filter(Boolean) || [];
        const deviceIds = editingRule.group_devices?.map((gd: any) => gd.device_id?.toString()).filter(Boolean) || [];

        setFormData({
          name: editingRule.name || '',
          description: editingRule.description || '',
          target_type: editingRule.target_type || 'individual',
          selected_employees: employeeIds,
          selected_devices: deviceIds,
          selected_zones: [],
          selected_departments: [],
          start_time: editingRule.start_time || '',
          end_time: editingRule.end_time || '',
          days: editingRule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          access_direction: editingRule.access_direction || 'both',
          priority: editingRule.priority || 100,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          target_type: 'individual',
          selected_employees: [],
          selected_devices: [],
          selected_zones: [],
          selected_departments: [],
          start_time: '',
          end_time: '',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          access_direction: 'both',
          priority: 100,
        });
      }
    }
  }, [open, editingRule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started:', formData);
    
    try {
      if (!formData.name.trim()) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Lütfen kural adı girin.",
        });
        return;
      }

      if (formData.selected_employees.length === 0) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Lütfen en az bir çalışan seçin.",
        });
        return;
      }
      
      if (formData.selected_devices.length === 0 && formData.selected_zones.length === 0) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Lütfen en az bir cihaz veya bölge seçin.",
        });
        return;
      }

      const ruleData = {
        name: formData.name,
        description: formData.description,
        target_type: formData.target_type,
        start_time: formData.start_time,
        end_time: formData.end_time,
        days: formData.days,
        access_direction: formData.access_direction,
        priority: formData.priority,
      };
      
      if (editingRule) {
        await updateAccessRule.mutateAsync({
          id: editingRule.id,
          updates: ruleData
        });
      } else {
        console.log('Creating new rule with batch operation:', {
          rule: ruleData,
          employeeIds: formData.selected_employees.map(id => parseInt(id)),
          deviceIds: formData.selected_devices.map(id => parseInt(id))
        });

        await createAccessRuleWithMembers.mutateAsync({
          rule: ruleData,
          employeeIds: formData.selected_employees.map(id => parseInt(id)),
          deviceIds: formData.selected_devices.map(id => parseInt(id))
        });
      }
      
      onClose();
      
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Bir hata oluştu. Lütfen tekrar deneyin.",
      });
    }
  };

  return {
    formData,
    setFormData,
    handleSubmit,
    isSubmitting: createAccessRuleWithMembers.isPending || updateAccessRule.isPending
  };
};
