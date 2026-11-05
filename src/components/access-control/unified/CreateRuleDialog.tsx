import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { effectiveDoorIds } from "./components/selectionHelpers";
import { useRuleForm } from "./hooks/useRuleForm";
import { RuleBasicInfo } from "./components/RuleBasicInfo";
import { DepartmentTree } from "./components/DepartmentTree";
import { ZoneDeviceTree } from "./components/ZoneDeviceTree";
import { ruleDaysSummary } from "./lib/presentation";
import { TimeSchedule } from "./components/TimeSchedule";
import type { AccessRule } from "@/types/access-control";
import type { RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: AccessRule | null;
  onClose: () => void;
  onDiffSaved?: (result: RuleSaveResult) => void;
}
const FORM_ID = "access-rule-form";
export default function CreateRuleDialog({
  open,
  onOpenChange,
  editingRule,
  onClose,
  onDiffSaved,
}: Props) {
  const {
    formData,
    setFormData,
    handleSubmit,
    isSubmitting,
    errors,
    isDirty,
    projectId,
  } = useRuleForm(editingRule, open, onClose, onDiffSaved);
  const { doors, loading: doorsLoading } = useZonesAndDoors();
  const doorCount = effectiveDoorIds(doors, formData).length;
  const wholeDeviceCount = formData.selected_devices.filter(
    (id) => !doors.some((door) => door.deviceId === id),
  ).length;
  const doorScope = [
    doorCount > 0 || wholeDeviceCount === 0 ? `${doorCount} kapı` : "",
    wholeDeviceCount > 0 ? `${wholeDeviceCount} cihazın tümü` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const guard = useUnsavedChangesGuard(isDirty);
  const { projectId: currentProjectId } = useActiveProject();
  const projectChanged = currentProjectId !== projectId;
  const previousProject = useRef(currentProjectId);
  const submittingRef = useRef(false);
  const close = () => {
    if (!submittingRef.current && !isSubmitting) guard.requestClose(onClose);
  };
  useEffect(() => {
    if (previousProject.current !== currentProjectId) {
      previousProject.current = currentProjectId;
      guard.requestClose(onClose);
    }
  }, [currentProjectId, guard, onClose]);
  const submit: typeof handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting || projectChanged) return;
    submittingRef.current = true;
    try {
      await handleSubmit(event);
    } finally {
      submittingRef.current = false;
    }
  };
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else close();
        }}
      >
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col p-0 gap-0 min-w-0"
          onEscapeKeyDown={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
        >
          <DialogHeader className="px-4 pt-5 pb-3 border-b">
            <DialogTitle>
              {editingRule ? "Kuralı düzenle" : "Yeni kural"}
            </DialogTitle>
            <DialogDescription>
              Kaydedince cihazlara gönderilir.
            </DialogDescription>
          </DialogHeader>
          <form
            id={FORM_ID}
            noValidate
            onSubmit={submit}
            className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4"
          >
            {projectChanged ? (
              <p role="alert">
                Proje değişti. Taslak önceki projeye aittir; devam etmek için
                önceki projeyi yeniden seçin veya vazgeçin.
              </p>
            ) : (
              <fieldset disabled={isSubmitting} className="space-y-5 min-w-0">
                <RuleBasicInfo
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <div className="grid gap-6 lg:grid-cols-2 min-w-0">
                  <section
                    aria-labelledby="rule-who-heading"
                    className="space-y-3 min-w-0"
                  >
                    <h2 id="rule-who-heading" className="font-semibold">
                      Kimler erişebilir?
                    </h2>
                    <div
                      id="rule-employees"
                      tabIndex={-1}
                      role="group"
                      aria-label="Kişi seçimi"
                      aria-invalid={!!errors.selectedEmployees}
                      aria-describedby={
                        errors.selectedEmployees
                          ? "rule-employees-error"
                          : undefined
                      }
                    >
                      {formData.target_type === "visitor" ? (
                        <p>
                          Ziyaretçi şablonu: mevcut üyelikler korunur.
                          Ziyaretçiler bu şablona Ziyaretçiler ekranından
                          eklenir.
                        </p>
                      ) : (
                        <QuerySectionBoundary resetKey={projectId ?? "none"}>
                          <DepartmentTree
                            formData={formData}
                            setFormData={setFormData}
                          />
                        </QuerySectionBoundary>
                      )}
                      {errors.selectedEmployees && (
                        <p
                          id="rule-employees-error"
                          role="alert"
                          className="text-danger"
                        >
                          {errors.selectedEmployees}
                        </p>
                      )}
                    </div>
                  </section>
                  <section
                    aria-labelledby="rule-where-heading"
                    className="space-y-3 min-w-0 lg:border-l lg:pl-6"
                  >
                    <h2 id="rule-where-heading" className="font-semibold">
                      Nerede ve ne zaman?
                    </h2>
                    <div
                      id="rule-devices"
                      tabIndex={-1}
                      role="group"
                      aria-label="Kapı ve cihaz seçimi"
                      aria-invalid={!!errors.selectedDevices}
                      aria-describedby={
                        errors.selectedDevices
                          ? "rule-devices-error"
                          : undefined
                      }
                    >
                      <QuerySectionBoundary resetKey={projectId ?? "none"}>
                        <ZoneDeviceTree
                          formData={formData}
                          setFormData={setFormData}
                        />
                      </QuerySectionBoundary>
                      {errors.selectedDevices && (
                        <p
                          id="rule-devices-error"
                          role="alert"
                          className="text-danger"
                        >
                          {errors.selectedDevices}
                        </p>
                      )}
                    </div>
                    <TimeSchedule
                      formData={formData}
                      setFormData={setFormData}
                      errors={errors}
                    />
                  </section>
                </div>
              </fieldset>
            )}
          </form>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground break-words">
            {formData.target_type === "visitor"
              ? "Ziyaretçi üyelikleri korunur"
              : `${formData.selected_employees.length} kişi`}{" "}
            · {doorsLoading ? "Kapılar yükleniyor…" : doorScope} ·{" "}
            {`${ruleDaysSummary(formData.days)} ${formData.start_time || formData.end_time ? `${formData.start_time}–${formData.end_time}` : "tüm gün"}`}
          </div>
          <DialogFooter className="px-4 py-3 border-t flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={close}
            >
              Vazgeç
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              disabled={isSubmitting || projectChanged}
            >
              {isSubmitting ? "Kaydediliyor…" : "Kuralı kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
