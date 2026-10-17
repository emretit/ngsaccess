
import { useState, useEffect } from 'react';
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { accessRuleSchema } from "./useAccessRuleSchema";
import { useComplexAccessRuleMutations } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { AccessRule, GroupMember, GroupDevice } from "@/types/access-control";
import { DEFAULT_WORKDAYS } from "../components/weekdays";

interface RuleFormData {
  name: string;
  description: string;
  target_type: 'all' | 'department' | 'position' | 'individual' | 'visitor';
  selected_employees: string[];
  selected_devices: string[];
  // IDE Smart permission.io kaynağı: kuralın etki ettiği kapılar (groupDoors).
  // Boşsa o cihazın tüm kapıları varsayılır (backend getRuleIoIdsForPanel fallback).
  selected_doors: string[];
  start_time: string;
  end_time: string;
  days: string[];
  access_direction: 'entry' | 'exit' | 'both';
  priority: number;
}

export const useRuleForm = (editingRule: AccessRule | null | undefined, open: boolean, onClose: () => void) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { projectId } = useActiveProject();
  const { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers } = useComplexAccessRuleMutations();

  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    target_type: 'individual',
    selected_employees: [],
    selected_devices: [],
    selected_doors: [],
    start_time: '',
    end_time: '',
    days: DEFAULT_WORKDAYS,
    access_direction: 'both',
    priority: 100,
  });

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (open) {
      setErrors({});
      if (editingRule) {
        // Convex returns camelCase: employeeId, deviceId
        const employeeIds = editingRule.groupMembers
          ?.map((gm: GroupMember) => String(gm.employeeId || '')).filter(Boolean) ?? [];
        const deviceIds = editingRule.groupDevices
          ?.map((gd: GroupDevice) => String(gd.deviceId || '')).filter(Boolean) ?? [];
        const doorIds = editingRule.groupDoors
          ?.map((gd) => String(gd.doorId || '')).filter(Boolean) ?? [];

        setFormData({
          name: editingRule.name || '',
          description: editingRule.description || '',
          target_type: editingRule.targetType === 'visitor' || editingRule.targetType === 'all' || editingRule.targetType === 'department' || editingRule.targetType === 'position' ? editingRule.targetType : 'individual',
          selected_employees: employeeIds,
          selected_devices: deviceIds,
          selected_doors: doorIds,
          start_time: editingRule.startTime || '',
          end_time: editingRule.endTime || '',
          days: editingRule.days || DEFAULT_WORKDAYS,
          access_direction: (editingRule.accessDirection as RuleFormData['access_direction'] | undefined) ?? 'both',
          priority: editingRule.priority ?? 100,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          target_type: 'individual',
          selected_employees: [],
          selected_devices: [],
          selected_doors: [],
          start_time: '',
          end_time: '',
          days: DEFAULT_WORKDAYS,
          access_direction: 'both',
          priority: 100,
        });
      }
    }
  }, [open, editingRule]);

  const action = useAsyncAction(async () => {
    const parsed = accessRuleSchema.safeParse({
      name: formData.name, description: formData.description, targetType: formData.target_type,
      selectedEmployees: formData.selected_employees, selectedDevices: formData.selected_devices,
      selectedZones: [], selectedDoors: formData.selected_doors, startTime: formData.start_time,
      endTime: formData.end_time, days: formData.days, accessDirection: formData.access_direction,
      priority: formData.priority,
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
    const ruleData = {
      name: parsed.data.name, description: formData.description,
      targetType: formData.target_type,
      days: formData.days, accessDirection: formData.access_direction,
      priority: formData.priority, projectId,
    };
    const deviceIds = formData.selected_devices as Id<"devices">[];
    const doorIds = formData.selected_doors as Id<"doors">[];
    if (editingRule) {
      await updateAccessRuleWithAdditionalMembers.mutateAsync({
        id: editingRule._id as Id<"accessRules">,
        updates: { ...ruleData, startTime: formData.start_time || null, endTime: formData.end_time || null },
        employeeIds: formData.target_type === 'visitor' ? undefined : formData.selected_employees as Id<"employees">[],
        deviceIds, doorIds,
      });
    } else {
      await createAccessRuleWithMembers.mutateAsync({
        rule: { ...ruleData, startTime: formData.start_time || undefined, endTime: formData.end_time || undefined },
        employeeIds: formData.selected_employees as Id<"employees">[], deviceIds, doorIds,
      });
    }
  }, { error: "Kural kaydedilemedi" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = accessRuleSchema.safeParse({
      name: formData.name, description: formData.description, targetType: formData.target_type,
      selectedEmployees: formData.selected_employees, selectedDevices: formData.selected_devices,
      selectedZones: [], selectedDoors: formData.selected_doors, startTime: formData.start_time,
      endTime: formData.end_time, days: formData.days, accessDirection: formData.access_direction,
      priority: formData.priority,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      const focusIds: Record<string, string> = { name: "name", startTime: "start_time", endTime: "end_time", days: "rule-days", selectedEmployees: "rule-employees", selectedDevices: "rule-devices" };
      requestAnimationFrame(() => document.getElementById(focusIds[String(parsed.error.issues[0]?.path[0])])?.focus());
      return;
    }
    setErrors({});
    if (await action.run()) onClose();
  };

  return { formData, setFormData, handleSubmit, errors, isSubmitting: action.pending };
};
