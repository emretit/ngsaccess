import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Employee } from "@/types/employee";
import PhotoUpload from "./PhotoUpload";
import FormActions from "./FormActions";
import EmployeeFormFields from "./EmployeeFormFields";
import { useEmployeeFormData } from "./hooks/useEmployeeFormData";
import { useEmployeeFormSubmit } from "./hooks/useEmployeeFormSubmit";
import { usePhotoUpload } from "./hooks/usePhotoUpload";
import { employeeFormSchema } from "./hooks/useEmployeeFormSchema";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";

interface EmployeeFormProps {
  employee?: Employee | null;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  onClose: () => void;
  onSave: (payload?: unknown) => void;
}

export default function EmployeeForm({
  employee,
  onClose,
  onSave,
  onDirtyChange,
  onPendingChange,
}: EmployeeFormProps) {
  const { projectId } = useActiveProjectScope();
  const rules = useQuery(
    api.accessRules.list,
    projectId ? { projectId } : "skip",
  );
  const memberships = rules?.filter((rule) =>
    rule.groupMembers.some((member) => member.employeeId === employee?._id),
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string>>
  >({});

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
  } = useEmployeeFormData(employee);

  const { isLoading, handleSubmit, stages, serverError } =
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

  useEffect(() => {
    onDirtyChange?.(
      initialData !== undefined &&
        JSON.stringify(formData) !== initialData &&
        stages.length === 0,
    );
  }, [formData, initialData, stages.length, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(isLoading || uploading);
  }, [isLoading, uploading, onPendingChange]);
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
    handleSubmit(formData);
  };

  if (employee && currentEmployee === null)
    return (
      <EmptyState
        title="Personel kaydı artık bulunamıyor."
        action={{ label: "Listeye dön", onClick: onClose }}
      />
    );
  return (
    <form
      onSubmit={onSubmit}
      className="flex h-full min-h-0 flex-col"
      noValidate
    >
      <fieldset
        disabled={isLoading || uploading || stages.length > 0}
        className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-5"
      >
        <div className="space-y-4">
          {uploading && (
            <p role="status" className="text-xs text-muted-foreground">
              Fotoğraf yükleniyor…
            </p>
          )}
          {employee && (
            <p className="text-xs text-muted-foreground">
              Mevcut erişim üyelikleri:{" "}
              {memberships === undefined
                ? "Yükleniyor…"
                : memberships.map((rule) => rule.name).join(", ") || "Yok"}
            </p>
          )}

          {optionsLoading ? (
            <SectionSkeleton label="Form bilgileri yükleniyor" />
          ) : (
            <EmployeeFormFields
              autoFocusFirstName={!employee}
              formData={formData}
              setFormData={setFormData}
              companies={companies}
              departments={departments}
              accessRules={accessRules}
              positions={positions}
              photo={
                <>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG veya WebP · en çok 5 MB. Fotoğraf personel
                    profilinde kullanılır.
                  </p>
                  <PhotoUpload
                    photoPreview={photoPreview}
                    onPhotoChange={onPhotoChange}
                  />
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
        <p role="alert" className="px-5 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {stages.length > 0 && (
        <div
          role="status"
          className="max-h-40 shrink-0 space-y-2 overflow-y-auto border-t px-5 py-3 text-sm"
        >
          {stages.map((stage) => (
            <p key={stage}>{stage}</p>
          ))}
        </div>
      )}
      {stages.length > 0 && !isLoading ? (
        <button
          type="button"
          className="min-h-11 rounded-md border px-4 text-sm"
          onClick={() => onSave()}
        >
          Tamam
        </button>
      ) : (
        <FormActions
          isLoading={isLoading || optionsLoading || uploading}
          onClose={onClose}
        />
      )}
    </form>
  );
}
