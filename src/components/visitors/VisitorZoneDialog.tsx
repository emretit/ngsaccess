"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormActions } from "@/components/shared/FormActions";
import { Input } from "@/components/ui/input";
import { TimeSchedule } from "@/components/access-control/unified/components/TimeSchedule";
import { ZoneDeviceTree } from "@/components/access-control/unified/components/ZoneDeviceTree";
import { DEFAULT_WORKDAYS } from "@/components/access-control/unified/components/weekdays";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { accessScheduleError } from "../../../convex/lib/accessRuleUx";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import type { Id } from "../../../convex/_generated/dataModel";

interface ZoneFormData {
  name: string;
  selected_devices: string[];
  selected_doors: string[];
  start_time: string;
  end_time: string;
  days: string[];
}

const emptyZone = (): ZoneFormData => ({
  name: "",
  selected_devices: [],
  selected_doors: [],
  start_time: "",
  end_time: "",
  days: DEFAULT_WORKDAYS,
});

interface VisitorZoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (id: Id<"accessRules">) => void;
}

// Ziyaretçi bölgesi = targetType="visitor" bir accessRule. Kapılar (deviceIds) + günlük
// saat penceresi tanımlanır; üye eklenmez (ziyaretçiler Ziyaretçiler listesinden bağlanır).
export default function VisitorZoneDialog({ isOpen, onClose, onCreated }: VisitorZoneDialogProps) {
  const { projectId } = useActiveProject();
  const [formData, setFormData] = useState<ZoneFormData>(emptyZone);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ name: "", targets: "" });
  const [failed, setFailed] = useState(false);
  const guard = useUnsavedChangesGuard(JSON.stringify(formData) !== JSON.stringify(emptyZone()));
  const createRule = useMutation(api.accessRules.createWithGroups);

  const save = useAsyncAction(async () => {
    const id = await createRule({
      name: formData.name.trim(), projectId, targetType: "visitor",
      startTime: formData.start_time || undefined, endTime: formData.end_time || undefined,
      days: formData.days, accessDirection: "both",
      deviceIds: formData.selected_devices as Id<"devices">[],
      doorIds: formData.selected_doors as Id<"doors">[],
    });
    onCreated?.(id);
  }, { success: "Ziyaretçi bölgesi oluşturuldu", error: "Bölge oluşturulamadı" });
  const isSaving = save.pending;
  const close = () => { if (!isSaving) guard.requestClose(() => { setFormData(emptyZone()); onClose(); }); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = { name: formData.name.trim() ? "" : "Bölge adı girin", targets: formData.selected_devices.length || formData.selected_doors.length ? "" : "En az bir kapı/cihaz seçin" };
    setFieldErrors(errors);
    if (errors.name || errors.targets) return;
    const error = accessScheduleError({ days: formData.days, startTime: formData.start_time, endTime: formData.end_time });
    setScheduleError(error);
    if (error) { requestAnimationFrame(() => document.getElementById("start_time")?.focus()); return; }
    setFailed(false);
    if (await save.run()) { setFormData(emptyZone()); onClose(); } else setFailed(true);
  };

  return (
    <><Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-32px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ziyaretçi erişim bölgesi oluştur</DialogTitle>
          <DialogDescription>
            Ziyaretçilerin geçebileceği kapıları ve günlük saat penceresini belirleyin. Üyeler
            Ziyaretçiler listesinden eklenir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <fieldset disabled={isSaving} className="min-w-0 space-y-4">
          <FormFieldWrapper htmlFor="zone_name" label="Bölge adı *" error={fieldErrors.name}>
            <Input
              id="zone_name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="örn. Ziyaretçi - Giriş / Lobi"
              required
            />
          </FormFieldWrapper>

          <TimeSchedule formData={formData} setFormData={setFormData} />
          {scheduleError && <p role="alert" className="text-sm text-destructive">{scheduleError}</p>}
          <ZoneDeviceTree disableDoorless formData={formData} setFormData={setFormData} />

          {fieldErrors.targets && <p role="alert" className="text-sm text-destructive">{fieldErrors.targets}</p>}
          {failed && <p role="alert" className="text-sm text-destructive">Bölge oluşturulamadı. Girişleriniz korundu; tekrar deneyin.</p>}
          </fieldset>
          <FormActions layout="dialog" className="sticky bottom-0 bg-surface pt-3" isLoading={isSaving} onClose={close} submitLabel="Oluştur" />
        </form>
      </DialogContent>
    </Dialog>{guard.dialog}</>
  );
}
