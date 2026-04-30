
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useAccessRules } from "@/hooks/useAccessRules";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { AccessRule, GroupMember, GroupDevice } from "@/types/access-control";

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

export const useRuleForm = (editingRule: AccessRule | null | undefined, open: boolean, onClose: () => void) => {
  const { toast } = useToast();
  const { projectIds } = useProjectAccess();
  const { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers } = useAccessRules();

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
        // Convex returns camelCase: employeeId, deviceId
        const employeeIds = editingRule.groupMembers
          ?.map((gm: GroupMember) => String(gm.employeeId || '')).filter(Boolean) ?? [];
        const deviceIds = editingRule.groupDevices
          ?.map((gd: GroupDevice) => String(gd.deviceId || '')).filter(Boolean) ?? [];

        setFormData({
          name: editingRule.name || '',
          description: editingRule.description || '',
          target_type: (editingRule.targetType as RuleFormData['target_type'] | undefined) ?? 'individual',
          selected_employees: employeeIds,
          selected_devices: deviceIds,
          selected_zones: [],
          selected_departments: [],
          start_time: editingRule.startTime || '',
          end_time: editingRule.endTime || '',
          days: editingRule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          access_direction: (editingRule.accessDirection as RuleFormData['access_direction'] | undefined) ?? 'both',
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

      // Time alanları için undefined kontrolü
      const processedStartTime = formData.start_time.trim() === '' ? undefined : formData.start_time;
      const processedEndTime = formData.end_time.trim() === '' ? undefined : formData.end_time;

      // Convex expects camelCase field names
      const ruleData = {
        name: formData.name,
        description: formData.description,
        targetType: formData.target_type,
        startTime: processedStartTime,
        endTime: processedEndTime,
        days: formData.days,
        accessDirection: formData.access_direction,
        priority: formData.priority,
        projectId: projectIds[0] as Id<"projects"> | undefined,
      };

      // IDs are Convex string IDs, pass as-is (not parseInt)
      const employeeIds = formData.selected_employees as Id<"employees">[];
      const deviceIds = formData.selected_devices as Id<"devices">[];

      if (editingRule) {
        const ruleId = editingRule._id as Id<"accessRules">;
        await updateAccessRuleWithAdditionalMembers.mutateAsync({
          id: ruleId,
          updates: ruleData,
          employeeIds,
          deviceIds,
        });
      } else {
        await createAccessRuleWithMembers.mutateAsync({
          rule: ruleData,
          employeeIds,
          deviceIds,
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
    isSubmitting: createAccessRuleWithMembers.isPending || updateAccessRuleWithAdditionalMembers.isPending
  };
};
