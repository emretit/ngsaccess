import { useState } from 'react';
import { Employee } from '@/types/employee';
import PhotoUpload from './PhotoUpload';
import FormActions from './FormActions';
import EmployeeFormFields from './EmployeeFormFields';
import { useEmployeeFormData } from './hooks/useEmployeeFormData';
import { useEmployeeFormSubmit } from './hooks/useEmployeeFormSubmit';
import { usePhotoUpload } from './hooks/usePhotoUpload';
import { employeeFormSchema } from './hooks/useEmployeeFormSchema';
import { Loader2 } from 'lucide-react';

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
  onSave: (payload?: unknown) => void;
}

export default function EmployeeForm({ employee, onClose, onSave }: EmployeeFormProps) {
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

  const { handleFileChange } = usePhotoUpload();

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(
      e,
      (url) => setFormData({ ...formData, photoUrl: url }),
      setPhotoPreview
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        <PhotoUpload photoPreview={photoPreview} onPhotoChange={onPhotoChange} />

        {optionsLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Form bilgileri yükleniyor...
          </div>
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

      <FormActions isLoading={isLoading || optionsLoading} onClose={onClose} />
    </form>
  );
}
