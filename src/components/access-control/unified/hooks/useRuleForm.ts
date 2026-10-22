import { initialScheduleMode, scheduleBinding } from "../templates/model";
import { useState, useEffect, useRef } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { accessRuleSchema } from "./useAccessRuleSchema";
import { useComplexAccessRuleMutations, type RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type {
  AccessRule,
  GroupMember,
  GroupDevice,
} from "@/types/access-control";
import { DEFAULT_WORKDAYS } from "../components/weekdays";

import { buildRelationDiff } from "../../../../../convex/lib/accessRuleDiff";

interface RuleFormData {
  scheduleMode: "custom" | "template";
  scheduleTemplateId: string;
  name: string;
  description: string;
  target_type: "all" | "department" | "position" | "individual" | "visitor";
  selected_employees: string[];
  selected_devices: string[];
  // IDE Smart permission.io kaynağı: kuralın etki ettiği kapılar (groupDoors).
  // Boşsa o cihazın tüm kapıları varsayılır (backend getRuleIoIdsForPanel fallback).
  selected_doors: string[];
  start_time: string;
  end_time: string;
  days: string[];
  access_direction: "entry" | "exit" | "both";
  priority: number;
}

export const useRuleForm = (
  editingRule: AccessRule | null | undefined,
  open: boolean,
  onClose: () => void,
  onDiffSaved?: (result: RuleSaveResult) => void,
) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { projectId: activeProjectId } = useActiveProject();
  const [projectId] = useState(editingRule?.projectId ?? activeProjectId);
  const { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers } =
    useComplexAccessRuleMutations(onDiffSaved);

  const [formData, setFormData] = useState<RuleFormData>({
    scheduleMode: "custom",
    scheduleTemplateId: "",
    name: "",
    description: "",
    target_type: "individual",
    selected_employees: [],
    selected_devices: [],
    selected_doors: [],
    start_time: "",
    end_time: "",
    days: DEFAULT_WORKDAYS,
    access_direction: "both",
    priority: 100,
  });

  const [initialData, setInitialData] = useState(JSON.stringify(formData));
  const openingForm = useRef(formData);
  const openingSelection = useRef({ employees: [] as Id<"employees">[], devices: [] as Id<"devices">[], doors: [] as Id<"doors">[] });

  // Reset form when dialog opens/closes or editing rule changes
  useEffect(() => {
    if (open) {
      setErrors({});
      if (editingRule) {
        // Convex returns camelCase: employeeId, deviceId
        const employeeIds =
          editingRule.groupMembers
            ?.map((gm: GroupMember) => String(gm.employeeId || ""))
            .filter(Boolean) ?? [];
        const deviceIds =
          editingRule.groupDevices
            ?.map((gd: GroupDevice) => String(gd.deviceId || ""))
            .filter(Boolean) ?? [];
        const doorIds =
          editingRule.groupDoors
            ?.map((gd) => String(gd.doorId || ""))
            .filter(Boolean) ?? [];

        openingSelection.current = {
          employees: employeeIds as Id<"employees">[],
          devices: deviceIds as Id<"devices">[],
          doors: doorIds as Id<"doors">[],
        };
        const initial: RuleFormData = {
          scheduleMode: initialScheduleMode(editingRule.scheduleTemplateId),
          scheduleTemplateId: editingRule.scheduleTemplateId ?? "",
          name: editingRule.name || "",
          description: editingRule.description || "",
          target_type:
            editingRule.targetType === "visitor" ||
            editingRule.targetType === "all" ||
            editingRule.targetType === "department" ||
            editingRule.targetType === "position"
              ? editingRule.targetType
              : "individual",
          selected_employees: employeeIds,
          selected_devices: deviceIds,
          selected_doors: doorIds,
          start_time: editingRule.startTime || "",
          end_time: editingRule.endTime || "",
          days: editingRule.days || DEFAULT_WORKDAYS,
          access_direction:
            (editingRule.accessDirection as
              | RuleFormData["access_direction"]
              | undefined) ?? "both",
          priority: editingRule.priority ?? 100,
        };
        openingForm.current = initial;
        setInitialData(JSON.stringify(initial));
        setFormData(initial);
      } else {
        const initial: RuleFormData = {
          scheduleMode: "custom",
          scheduleTemplateId: "",
          name: "",
          description: "",
          target_type: "individual",
          selected_employees: [],
          selected_devices: [],
          selected_doors: [],
          start_time: "",
          end_time: "",
          days: DEFAULT_WORKDAYS,
          access_direction: "both",
          priority: 100,
        };
        openingForm.current = initial;
        setInitialData(JSON.stringify(initial));
        setFormData(initial);
      }
    }
  }, [open, editingRule]);

  const action = useAsyncAction(
    async () => {
      const parsed = accessRuleSchema.safeParse({
        scheduleMode: formData.scheduleMode,
        scheduleTemplateId: formData.scheduleTemplateId,
        name: formData.name,
        description: formData.description,
        targetType: formData.target_type,
        selectedEmployees: formData.selected_employees,
        selectedDevices: formData.selected_devices,
        selectedZones: [],
        selectedDoors: formData.selected_doors,
        startTime: formData.start_time,
        endTime: formData.end_time,
        days: formData.days,
        accessDirection: formData.access_direction,
        priority: formData.priority,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      const ruleData = {
        scheduleTemplateId: scheduleBinding(
          formData.scheduleMode,
          formData.scheduleTemplateId,
        ),
        name: parsed.data.name,
        description: formData.description,
        targetType: formData.target_type,
        days: formData.days,
        accessDirection: formData.access_direction,
        priority: formData.priority,
        projectId,
      };
      const deviceIds = formData.selected_devices as Id<"devices">[];
      const doorIds = formData.selected_doors as Id<"doors">[];
      if (editingRule) {
        await updateAccessRuleWithAdditionalMembers.mutateAsync({
          id: editingRule._id as Id<"accessRules">,
          updates: {
            projectId,
            scheduleTemplateId: scheduleBinding(
              formData.scheduleMode,
              formData.scheduleTemplateId,
              editingRule.scheduleTemplateId,
            ),
            name: formData.name !== openingForm.current.name ? parsed.data.name : undefined,
            description: formData.description !== openingForm.current.description ? formData.description : undefined,
            targetType: formData.target_type !== openingForm.current.target_type ? formData.target_type : undefined,
            days: JSON.stringify(formData.days) !== JSON.stringify(openingForm.current.days) ? formData.days : undefined,
            accessDirection: formData.access_direction !== openingForm.current.access_direction ? formData.access_direction : undefined,
            priority: formData.priority !== openingForm.current.priority ? formData.priority : undefined,
            startTime: formData.start_time !== openingForm.current.start_time ? formData.start_time || null : undefined,
            endTime: formData.end_time !== openingForm.current.end_time ? formData.end_time || null : undefined,
          },
          relationDiff: {
            employees: formData.target_type === "visitor"
              ? { added: [], removed: [] }
              : buildRelationDiff(openingSelection.current.employees, formData.selected_employees as Id<"employees">[]),
            devices: buildRelationDiff(openingSelection.current.devices, deviceIds),
            doors: buildRelationDiff(openingSelection.current.doors, doorIds),
          },
        });
      } else {
        await createAccessRuleWithMembers.mutateAsync({
          rule: {
            ...ruleData,
            startTime: formData.start_time || undefined,
            endTime: formData.end_time || undefined,
          },
          employeeIds: formData.selected_employees as Id<"employees">[],
          deviceIds,
          doorIds,
        });
      }
    },
    { error: "Kural kaydedilemedi" },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = accessRuleSchema.safeParse({
      scheduleMode: formData.scheduleMode,
      scheduleTemplateId: formData.scheduleTemplateId,
      name: formData.name,
      description: formData.description,
      targetType: formData.target_type,
      selectedEmployees: formData.selected_employees,
      selectedDevices: formData.selected_devices,
      selectedZones: [],
      selectedDoors: formData.selected_doors,
      startTime: formData.start_time,
      endTime: formData.end_time,
      days: formData.days,
      accessDirection: formData.access_direction,
      priority: formData.priority,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message;
      setErrors(next);
      const focusIds: Record<string, string> = {
        name: "name",
        startTime: "start_time",
        endTime: "end_time",
        days: "rule-days",
        scheduleTemplateId: "rule-schedule-template",
        selectedEmployees: "rule-employees",
        selectedDevices: "rule-devices",
      };
      requestAnimationFrame(() =>
        document
          .getElementById(focusIds[String(parsed.error.issues[0]?.path[0])])
          ?.focus(),
      );
      return;
    }
    setErrors({});
    if (await action.run()) onClose();
  };

  return {
    isDirty: JSON.stringify(formData) !== initialData,
    projectId,
    formData,
    setFormData,
    handleSubmit,
    errors,
    isSubmitting: action.pending,
  };
};
