import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from 'react';
import { Employee } from '@/types/employee';
import PhotoUpload from './PhotoUpload';
import FormActions from './FormActions';
import EmployeeFormFields from './EmployeeFormFields';
import { useEmployeeFormData } from './hooks/useEmployeeFormData';
import { useEmployeeFormSubmit } from './hooks/useEmployeeFormSubmit';
import { usePhotoUpload } from './hooks/usePhotoUpload';
import { employeeFormSchema } from './hooks/useEmployeeFormSchema';
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
  onSave: (payload?: unknown) => void;
}

export default function EmployeeForm({ employee, onClose, onSave }: EmployeeFormProps) {
  const { projectId } = useActiveProjectScope();
  const rules = useQuery(api.accessRules.list, projectId ? { projectId } : "skip");
  const memberships = rules?.filter(rule => rule.groupMembers.some(member => member.employeeId === employee?._id));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const {
    formData,
    setFormData,
    departments,
    companies,
    accessRules,
    positions,
    photoPreview,
    setPhotoPreview,
    optionsLoading,
  } = useEmployeeFormData(employee);

  const { isLoading, handleSubmit } = useEmployeeFormSubmit(employee, onClose, onSave);

  const { handleFileChange, isLoading: uploading } = usePhotoUpload();

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(
      e,
      (url, storageId) => setFormData(current => ({ ...current, photoUrl: url, photoStorageId: storageId })),
      (preview) => setPhotoPreview(preview || formData.photoUrl)
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    const result = employeeFormSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    handleSubmit(formData);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">JPEG, PNG veya WebP · en çok 5 MB. {uploading ? "Fotoğraf yükleniyor…" : ""}</p>
        {employee && <p className="text-xs text-muted-foreground">Mevcut erişim üyelikleri: {memberships === undefined ? "Yükleniyor…" : memberships.map(rule => rule.name).join(", ") || "Yok"}</p>}
        <PhotoUpload photoPreview={photoPreview} onPhotoChange={onPhotoChange} />

        {optionsLoading ? (
          <SectionSkeleton label="Form bilgileri yükleniyor" />
        ) : (
          <EmployeeFormFields
            formData={formData}
            setFormData={setFormData}
            companies={companies}
            departments={departments}
            accessRules={accessRules}
            positions={positions}
            errors={fieldErrors}
          />
        )}
      </div>

      <FormActions isLoading={isLoading || optionsLoading || uploading} onClose={onClose} />
    </form>
  );
}
