
import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useAccessRules, AccessRuleFormData } from "@/hooks/useAccessRules";
import { useToast } from "@/components/ui/use-toast";
import DepartmentEmployeeSelector from "./DepartmentEmployeeSelector";
import ZoneDoorSelector from "./ZoneDoorSelector";
import { FormHeader } from "./form/FormHeader";
import { BasicInfoFields } from "./form/BasicInfoFields";
import { TimeFields } from "./form/TimeFields";
import { DaysSelector } from "./form/DaysSelector";
import { FormActions } from "./form/FormActions";

interface UnifiedRuleFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

interface ZoneDoorSelection {
  type: "zone" | "door";
  id: number;
  name: string;
}

export function UnifiedRuleForm({ open, onOpenChange }: UnifiedRuleFormProps) {
  const { toast } = useToast();
  const { createRule, isCreating } = useAccessRules();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selection, setSelection] = useState<DepartmentEmployeeSelection[]>([]);
  const [zonesDoors, setZonesDoors] = useState<ZoneDoorSelection[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<string[]>(["paz", "sal", "çar", "per", "cum"]);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSelectionChange = (newSelection: DepartmentEmployeeSelection[]) => {
    setSelection(newSelection);
    if (errors.selection) {
      setErrors(prev => ({ ...prev, selection: "" }));
    }
  };

  const handleZonesDoorChange = (newSelection: ZoneDoorSelection[]) => {
    setZonesDoors(newSelection);
    if (errors.access_points) {
      setErrors(prev => ({ ...prev, access_points: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Kural adı zorunludur";
    }

    if (selection.length === 0) {
      newErrors.selection = "En az bir departman veya personel seçmelisiniz";
    }

    if (zonesDoors.length === 0) {
      newErrors.access_points = "En az bir kapı veya bölge seçmelisiniz";
    }

    if (days.length === 0) {
      newErrors.days = "En az bir gün seçmelisiniz";
    }

    if (startTime >= endTime) {
      newErrors.time = "Başlangıç saati bitiş saatinden önce olmalıdır";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelection([]);
    setZonesDoors([]);
    setStartTime("08:00");
    setEndTime("18:00");
    setDays(["paz", "sal", "çar", "per", "cum"]);
    setIsActive(true);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Form Hatası",
        description: "Lütfen tüm zorunlu alanları doldurun ve hataları düzeltin.",
      });
      return;
    }

    const formData: AccessRuleFormData = {
      name: name.trim(),
      description: description.trim() || undefined,
      departments: selection.filter(s => s.type === "department") as Array<{ type: "department"; id: number; name: string }>,
      employees: selection.filter(s => s.type === "employee") as Array<{ type: "employee"; id: number; name: string }>,
      zones: zonesDoors.filter(z => z.type === "zone") as Array<{ type: "zone"; id: number; name: string }>,
      doors: zonesDoors.filter(z => z.type === "door") as Array<{ type: "door"; id: number; name: string }>,
      start_time: startTime,
      end_time: endTime,
      days,
      is_active: isActive
    };

    createRule(formData, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      }
    });
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="shadow-2xl border-0 bg-transparent w-full max-w-2xl p-0 flex justify-center items-center"
        style={{
          minWidth: 700,
          maxWidth: 900,
          borderRadius: 24,
        }}
      >
        <div className="w-full">
          <div
            className="rounded-3xl bg-gradient-to-br from-[#F1F0FB] via-white to-[#FAE8E8] dark:from-[#28213c] dark:to-[#260F19] border border-gray-200 dark:border-gray-700 shadow-xl p-0 overflow-hidden"
            style={{
              minWidth: 700,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <FormHeader onClose={handleClose} disabled={isCreating} />

            <form
              className="p-10 bg-white/85 dark:bg-[#1A1F2C]/80"
              autoComplete="off"
              onSubmit={handleSubmit}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BasicInfoFields
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  isActive={isActive}
                  setIsActive={setIsActive}
                  isCreating={isCreating}
                  errors={errors}
                  setErrors={setErrors}
                />

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Departman & Personel *
                  </label>
                  <div className={`rounded-xl border ${
                    errors.selection ? "border-red-500" : "border-gray-100 dark:border-gray-800"
                  } bg-white/80 dark:bg-gray-900/40 p-2`}>
                    <DepartmentEmployeeSelector
                      value={selection}
                      onChange={handleSelectionChange}
                      disabled={isCreating}
                    />
                  </div>
                  {errors.selection && (
                    <span className="text-red-500 text-xs">{errors.selection}</span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Kapı & Bölge *
                  </label>
                  <div className={`rounded-xl border ${
                    errors.access_points ? "border-red-500" : "border-gray-100 dark:border-gray-800"
                  } bg-white/80 dark:bg-gray-900/40 p-2`}>
                    <ZoneDoorSelector
                      value={zonesDoors}
                      onChange={handleZonesDoorChange}
                      disabled={isCreating}
                    />
                  </div>
                  {errors.access_points && (
                    <span className="text-red-500 text-xs">{errors.access_points}</span>
                  )}
                </div>

                <TimeFields
                  startTime={startTime}
                  setStartTime={setStartTime}
                  endTime={endTime}
                  setEndTime={setEndTime}
                  isCreating={isCreating}
                  errors={errors}
                  setErrors={setErrors}
                />

                <DaysSelector
                  days={days}
                  setDays={setDays}
                  isCreating={isCreating}
                  errors={errors}
                  setErrors={setErrors}
                />
              </div>

              <FormActions onCancel={handleClose} isCreating={isCreating} />
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
