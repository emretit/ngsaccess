import { requestTemplateEdit } from "./templates/model";
import { useEffect, useRef, useState } from "react";
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
import { useRuleForm } from "./hooks/useRuleForm";
import { RuleBasicInfo } from "./components/RuleBasicInfo";
import { DepartmentTree } from "./components/DepartmentTree";
import { ZoneDeviceTree } from "./components/ZoneDeviceTree";
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
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
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
  const go = (next: number) => {
    setStep(next);
    setStepError("");
    requestAnimationFrame(() =>
      document.getElementById("rule-step-heading")?.focus(),
    );
  };
  const advance = () => {
    if (step === 0 && !formData.name.trim()) {
      setStepError("Lütfen kural adı girin.");
      document.getElementById("name")?.focus();
      return;
    }
    if (
      step === 1 &&
      formData.target_type === "individual" &&
      formData.selected_employees.length === 0
    ) {
      setStepError("En az bir kişi seçin.");
      return;
    }
    go(step + 1);
  };
  const submit: typeof handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting || projectChanged) return;
    if (!formData.name.trim()) {
      go(0);
      setStepError("Lütfen kural adı girin.");
      return;
    }
    if (
      formData.target_type === "individual" &&
      formData.selected_employees.length === 0
    ) {
      go(1);
      setStepError("En az bir kişi seçin.");
      return;
    }
    if (step !== 2) {
      advance();
      return;
    }
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
          className="w-[calc(100%-2rem)] max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col p-0 gap-0 min-w-0"
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
              {editingRule
                ? "Yalnız değiştirdiğiniz ilişkiler kaydedilir. Cihaz işlemleri arka planda yürütülür; kayıt, cihazda teslim onayı değildir."
                : "Kayıt başarılı olduğunda cihaz gönderimi ayrıca başlatılır ve izlenir."}
            </DialogDescription>
          </DialogHeader>
          <nav
            aria-label="Kural adımları"
            className="flex flex-wrap gap-1 border-b p-3"
          >
            {["Temel", "Kimler", "Nerede / Ne zaman"].map((label, index) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={step === index ? "default" : "ghost"}
                aria-current={step === index ? "step" : undefined}
                disabled={isSubmitting || (!editingRule && index > step)}
                onClick={() => go(index)}
              >
                {index + 1}. {label}
              </Button>
            ))}
          </nav>
          <form
            id={FORM_ID}
            noValidate
            onSubmit={submit}
            className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4 space-y-4"
          >
            <h2 id="rule-step-heading" tabIndex={-1} className="font-semibold">
              {
                ["Temel bilgiler", "Kimler erişebilir?", "Nerede ve ne zaman?"][
                  step
                ]
              }
            </h2>
            {projectChanged ? (
              <p role="alert">
                Proje değişti. Taslak önceki projeye aittir; devam etmek için
                önceki projeyi yeniden seçin veya vazgeçin.
              </p>
            ) : (
              <fieldset disabled={isSubmitting} className="space-y-4 min-w-0">
                {step === 0 && (
                  <RuleBasicInfo
                    formData={formData}
                    setFormData={setFormData}
                    errors={{
                      ...errors,
                      ...(stepError ? { name: stepError } : {}),
                    }}
                  />
                )}
                {step === 1 && (
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
                        Ziyaretçiler bu şablona Ziyaretçiler ekranından eklenir.
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
                )}
                {step === 2 && (
                  <>
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
                      currentTemplateId={editingRule?.scheduleTemplateId}
                      onEditTemplate={(navigate) => {
                        if (!submittingRef.current && !isSubmitting) {
                          requestTemplateEdit(guard.requestClose, onClose, navigate);
                        }
                      }}
                      formData={formData}
                      setFormData={setFormData}
                      errors={errors}
                    />
                  </>
                )}
              </fieldset>
            )}
            {stepError && step !== 0 && (
              <p role="alert" className="text-danger text-xs">
                {stepError}
              </p>
            )}
          </form>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground break-words">
            {formData.target_type === "visitor"
              ? "Ziyaretçi üyelikleri korunur"
              : `${formData.selected_employees.length} kişi`}{" "}
            → {formData.selected_devices.length} panel /{" "}
            {formData.selected_doors.length} açık kapı seçimi →{" "}
            {formData.scheduleMode === "template"
              ? "Şablon kullanılıyor"
              : `${formData.days.length} gün · ${formData.start_time || formData.end_time ? `${formData.start_time}–${formData.end_time}` : "Tüm gün"}`}
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
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => go(step - 1)}
              >
                Geri
              </Button>
            )}
            {/* Ayrı key: aynı DOM düğmesi tıklama sırasında type="submit"e dönüp formu göndermesin. */}
            {step < 2 ? (
              <Button
                key="next"
                type="button"
                disabled={isSubmitting || projectChanged}
                onClick={advance}
              >
                İleri
              </Button>
            ) : (
              <Button
                key="submit"
                type="submit"
                form={FORM_ID}
                disabled={isSubmitting || projectChanged}
              >
                {isSubmitting ? "Kaydediliyor…" : "Kuralı kaydet"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
