
import { Employee } from '@/types/employee';
import PhotoUpload from './PhotoUpload';
import FormActions from './FormActions';
import EmployeeFormFields from './EmployeeFormFields';
import { useEmployeeFormData } from './hooks/useEmployeeFormData';
import { useEmployeeFormSubmit } from './hooks/useEmployeeFormSubmit';
import { usePhotoUpload } from './hooks/usePhotoUpload';

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
  onSave: (employee: Employee) => void;
}

export default function EmployeeForm({ employee, onClose, onSave }: EmployeeFormProps) {
  console.log('=== EMPLOYEE FORM RENDER ===');
  console.log('Employee prop:', employee);
  
  const {
    formData,
    setFormData,
    departments,
    companies,
    shifts,
    positions,
    photoPreview,
    setPhotoPreview,
  } = useEmployeeFormData(employee);

  const { isLoading, handleSubmit } = useEmployeeFormSubmit(
    employee,
    onClose,
    onSave,
    departments,
    positions
  );

  const { handleFileChange } = usePhotoUpload();

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(
      e,
      (url) => setFormData({ ...formData, photo_url: url }),
      setPhotoPreview
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form onSubmit called');
    handleSubmit(formData);
  };

  console.log('Current form data:', formData);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-4">
        <PhotoUpload
          photoPreview={photoPreview}
          onPhotoChange={onPhotoChange}
        />

        <EmployeeFormFields
          formData={formData}
          setFormData={setFormData}
          companies={companies}
          departments={departments}
          shifts={shifts}
          positions={positions}
        />
      </div>

      <FormActions isLoading={isLoading} onClose={onClose} />
    </form>
  );
}
