import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAccessRules } from "@/hooks/useAccessRules";
import type { AccessRule, GroupDevice, GroupMember } from "@/types/access-control";
import { accessRuleSchema } from "../hooks/useAccessRuleSchema";

export type TargetType = "all" | "department" | "position" | "individual";
export type AccessDirection = "entry" | "exit" | "both";

export interface EnhancedRuleFormData {
  name: string;
  description: string;
  targetType: TargetType;
  selectedEmployees: string[];
  selectedDevices: string[];
  selectedPositions: string[];
  selectedZones: string[];
  selectedDoors: string[];
  startTime: string;
  endTime: string;
  days: string[];
  accessDirection: AccessDirection;
  priority: number;
}

const DEFAULT_FORM: EnhancedRuleFormData = {
  name: "",
  description: "",
  targetType: "individual",
  selectedEmployees: [],
  selectedDevices: [],
  selectedPositions: [],
  selectedZones: [],
  selectedDoors: [],
  startTime: "",
  endTime: "",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  accessDirection: "both",
  priority: 100,
};

interface UseEnhancedRuleFormArgs {
  open: boolean;
  editingRule?: AccessRule;
  onClose: () => void;
}

export function useEnhancedRuleForm({ open, editingRule, onClose }: UseEnhancedRuleFormArgs) {
  const [formData, setFormData] = useState<EnhancedRuleFormData>(DEFAULT_FORM);
  const { createAccessRule, isCreating, updateAccessRule, isUpdating } = useAccessRules();

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setFormData({
        name: editingRule.name || "",
        description: editingRule.description || "",
        targetType: (editingRule.targetType as TargetType | undefined) ?? "individual",
        selectedEmployees:
          editingRule.groupMembers
            ?.map((gm: GroupMember) => gm.employees?.id)
            .filter((id): id is NonNullable<typeof id> => Boolean(id))
            .map(String) ?? [],
        selectedDevices:
          editingRule.groupDevices
            ?.map((gd: GroupDevice) => gd.devices?.id)
            .filter((id): id is NonNullable<typeof id> => Boolean(id))
            .map(String) ?? [],
        selectedPositions: [],
        selectedZones: [],
        selectedDoors: [],
        startTime: editingRule.startTime || "",
        endTime: editingRule.endTime || "",
        days: editingRule.days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        accessDirection: (editingRule.accessDirection as AccessDirection | undefined) ?? "both",
        priority: editingRule.priority || 100,
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [open, editingRule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = accessRuleSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      toast({
        title: "Hata",
        description: firstError?.message ?? "Form bilgileri geçersiz",
        variant: "destructive",
      });
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

    try {
      if (editingRule) {
        await updateAccessRule.mutateAsync({
          id: editingRule._id,
          updates: ruleData,
        });
        toast({ title: "Başarılı", description: "Kural güncellendi." });
      } else {
        await createAccessRule.mutateAsync(ruleData);
        toast({ title: "Başarılı", description: "Kural oluşturuldu." });
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kural kaydedilemedi.";
      toast({ title: "Hata", description: message, variant: "destructive" });
    }
  };

  return {
    formData,
    setFormData,
    handleSubmit,
    isSubmitting: isCreating || isUpdating,
    isCreating,
    isUpdating,
  };
}
