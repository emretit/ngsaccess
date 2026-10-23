import { usePermissions } from "@/hooks/usePermissions";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState, type RefObject } from "react";
import { Employee } from "@/types/employee";
import PhotoUpload from "./PhotoUpload";
import FormActions from "./FormActions";
import EmployeeFormFields from "./EmployeeFormFields";
import type { EmployeeFormDraft } from "./hooks/useEmployeeFormData";
import { useEmployeeFormData } from "./hooks/useEmployeeFormData";
import type { EmployeeSaveResult } from "./hooks/useEmployeeFormSubmit";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { Button } from "@/components/ui/button";
import { useEmployeeFormSubmit } from "./hooks/useEmployeeFormSubmit";
import { usePhotoUpload } from "./hooks/usePhotoUpload";
import { employeeFormSchema } from "./hooks/useEmployeeFormSchema";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { cn } from "@/lib/utils";

interface EmployeeFormProps {
  employee?: Employee | null;
  /** Ayrıntı drawer'ı içinde, kendi kaydırma alanı olmadan çizilir. */
  embedded?: boolean;
  draft?: RefObject<EmployeeFormDraft | undefined>;
  /** Varsayılan: yalnız yeni kayıtta Ad alanına odaklan. */
  autoFocusFirstName?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  onClose: () => void;
  onExit?: () => void;
  onContinue?: (payload: EmployeeSaveResult) => void;
  onSave: (payload: EmployeeSaveResult) => void;
}

export default function EmployeeForm({
  employee,
  embedded = false,
  draft,
  autoFocusFirstName = !employee,
  onClose,
  onSave,
  onExit = onClose,
  onContinue,
  onDirtyChange,
  onPendingChange,
}: EmployeeFormProps) {
  const { projectId } = useActiveProjectScope();
  const { can } = usePermissions();
  const rules: FunctionReturnType<typeof api.accessRules.listMemberships> | undefined = useQuery(
    api.accessRules.listMemberships,
    projectId ? { projectId } : "skip",
  );
  const memberships = rules?.filter((rule) =>
    rule.groupMembers.some((member) => member.employeeId === employee?._id),
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string>>
  >({});

  const { isLoading, handleSubmit, stages, serverError, savedResult } =
    useEmployeeFormSubmit(employee, onClose, onSave, (key, message) => {
      setFieldErrors({ [key]: message });
      requestAnimationFrame(() =>
        document.getElementById(`employee-${key}`)?.focus(),
      );
    });

  const {
    handleFileChange,
    isLoading: uploading,
    error: photoError,
  } = usePhotoUpload();

  const {
    formData,
    initialData,
    setFormData,
    departments,
    companies,
    accessRules,
    positions,
    photoPreview,
    setPhotoPreview,
    optionsLoading,
    remoteChanged,
    reloadLatest,
  } = useEmployeeFormData(employee, { saving: isLoading || uploading, saved: stages.length > 0, draft });

  const dirty =
    initialData !== undefined &&
    JSON.stringify(formData) !== initialData &&
    stages.length === 0;
  const reloadGuard = useUnsavedChangesGuard(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(isLoading || uploading);
  }, [isLoading, uploading, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const currentEmployee = useQuery(
    api.employees.getById,
    employee ? { employeeId: employee._id } : "skip",
  );
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(
      e,
      (url, storageId) =>
        setFormData((current) => ({
          ...current,
          photoUrl: url,
          photoStorageId: storageId,
        })),
      (preview) => setPhotoPreview(preview || formData.photoUrl),
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading || isLoading || stages.length > 0) return;
    const result = employeeFormSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      requestAnimationFrame(() =>
        document.getElementById(`employee-${Object.keys(errors)[0]}`)?.focus(),
      );
      return;
    }
    setFieldErrors({});
    handleSubmit(formData, employee ? initialData : undefined);
  };

  if (employee && currentEmployee === null && embedded) return null;
  if (employee && currentEmployee === null)
    return (
      <EmptyState
        title="Personel kaydı artık bulunamıyor."
        action={{ label: "Listeye dön", onClick: onExit }}
      />
    );
  return (
    <form
      onSubmit={onSubmit}
      className={embedded ? "min-w-0" : "flex h-full min-h-0 flex-col"}
      aria-busy={isLoading}
      noValidate
    >
      {reloadGuard.dialog}
      {remoteChanged && (
        <div role="status" className="mb-3 text-sm">
          <p>Bu kayıt siz düzenlerken değişti. Kaydederseniz yalnız sizin değiştirdiğiniz alanlar yazılır.</p>
          <Button type="button" variant="outline" className="max-sm:min-h-11" onClick={() => reloadGuard.requestClose(() => { reloadLatest(); setFieldErrors({}); })}>Güncel hali yükle</Button>
        </div>
      )}
      {isLoading && <p role="status" className="sr-only">Kaydediliyor</p>}
      <fieldset
        disabled={!can("employees.manage") || isLoading || uploading || stages.length > 0}
        className={
          embedded
            ? "min-w-0"
            : "min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-4"
        }
      >
        <div className="space-y-3">
          {uploading && (
            <p role="status" className="text-xs text-muted-foreground">
              Fotoğraf yükleniyor…
            </p>
          )}

          {optionsLoading ? (
            <SectionSkeleton label="Form bilgileri yükleniyor" />
          ) : (
            <EmployeeFormFields
              canViewPay={can("pay.view")}
              isVisitor={employee?.isVisitor}
              autoFocusFirstName={autoFocusFirstName}
              isEditing={!!employee}
              originalDepartmentId={employee?.departmentId ?? null}
              memberships={memberships}
              formData={formData}
              setFormData={setFormData}
              companies={companies}
              departments={departments}
              accessRules={accessRules}
              positions={positions}
              photo={
                <>
                  <div className="flex items-center gap-4">
                    <PhotoUpload
                      photoPreview={photoPreview}
                      onPhotoChange={onPhotoChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG veya WebP · en çok 5 MB. Fotoğraf personel
                      profilinde kullanılır.
                    </p>
                  </div>
                  {photoError && (
                    <p role="alert" className="text-sm text-destructive">
                      {photoError}
                    </p>
                  )}
                </>
              }
              errors={fieldErrors}
            />
          )}
        </div>
      </fieldset>
      {serverError && (
        <p role="alert" className={cn("py-2 text-sm text-destructive", !embedded && "px-5")}>
          {serverError}
        </p>
      )}
      {stages.length > 0 && (
        <div
          role="status"
          className={cn("max-h-40 shrink-0 space-y-2 overflow-y-auto border-t py-3 text-sm", !embedded && "px-5")}
        >
          {stages.map((stage) => (
            <p key={stage}>{stage}</p>
          ))}
        </div>
      )}
      {stages.length > 0 && !isLoading && savedResult ? (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" className="max-sm:min-h-11" onClick={() => onSave(savedResult)}>Tamam</Button>
            {!employee && onContinue && <Button type="button" className="max-sm:min-h-11" onClick={() => onContinue(savedResult)}>Ayrıntılara devam et</Button>}
          </div>
          {!employee && <p className="text-xs text-muted-foreground">Rıza ve parmak izi işlemleri kişinin ayrıntılarında.</p>}
        </div>
      ) : (!embedded || dirty || isLoading || uploading) && (
        <FormActions
          isLoading={isLoading || optionsLoading || uploading}
          busyLabel={isLoading ? "Kaydediliyor" : uploading ? "Fotoğraf yükleniyor" : "Yükleniyor"}
          onClose={onClose}
          cancelLabel={embedded ? "Değişiklikleri geri al" : undefined}
          className={embedded ? "-mx-5 -bottom-4 mt-4" : undefined}
        />
      )}
    </form>
  );
}
