
import { useState } from 'react';
import { Employee } from '@/types/employee';
import PhotoUpload from './PhotoUpload';
import FormField from './FormField';
import FormActions from './FormActions';

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
  onSave: (employee: Employee) => void;
}

export default function EmployeeForm({ employee, onClose, onSave }: EmployeeFormProps) {
  const [formData, setFormData] = useState<Partial<Employee>>({
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    email: employee?.email || '',
    tc_no: employee?.tc_no || '',
    card_number: employee?.card_number || '',
    photo_url: employee?.photo_url || null,
    is_active: employee?.is_active ?? true,
    department_id: employee?.department_id || 0,
    position_id: employee?.position_id || null,
    company_id: employee?.company_id || null,
    shift_id: employee?.shift_id || null,
    shift: employee?.shift || null
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(employee?.photo_url || null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        // You'll need to implement file upload logic here
        // setFormData(prev => ({ ...prev, photo_url: uploaded_url }));
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await onSave(formData as Employee);
      onClose();
    } catch (error) {
      console.error('Error saving employee:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <PhotoUpload 
          photoPreview={photoPreview} 
          onPhotoChange={handleFileChange} 
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Ad"
            id="first_name"
            value={formData.first_name || ''}
            onChange={e => setFormData({ ...formData, first_name: e.target.value })}
            required
          />
          <FormField
            label="Soyad"
            id="last_name"
            value={formData.last_name || ''}
            onChange={e => setFormData({ ...formData, last_name: e.target.value })}
            required
          />
        </div>

        <FormField
          label="TC Kimlik No"
          id="tc_no"
          value={formData.tc_no || ''}
          onChange={e => setFormData({ ...formData, tc_no: e.target.value })}
          maxLength={11}
          pattern="[0-9]{11}"
          title="TC Kimlik No 11 haneli rakamlardan oluşmalıdır"
          required
        />

        <FormField
          label="Kart No"
          id="card_number"
          value={formData.card_number || ''}
          onChange={e => setFormData({ ...formData, card_number: e.target.value })}
          required
        />

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="is_active" className="text-sm">Aktif</label>
        </div>
      </div>

      <FormActions isLoading={isLoading} onClose={onClose} />
    </form>
  );
}
