import { useState, useEffect } from 'react';
import { Employee } from '@/types/employee';
import { supabase } from '@/integrations/supabase/client';
import { FormTextField, FormSelectField, FormTextArea } from './FormFields';
import PhotoUpload from './PhotoUpload';
import FormActions from './FormActions';

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
  onSave: (employee: Employee) => void;
}

export default function EmployeeForm({ employee, onClose, onSave }: EmployeeFormProps) {
  const [formData, setFormData] = useState<Partial<Employee> & {
    department?: string;
    position?: string;
    notes?: string;
  }>({
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    position: '',
    card_number: '',
    is_active: true,
    photo_url: '',
    tc_no: '',
    shift: '',
    company_id: null,
    notes: '',
  });

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      console.log("Yüklenen çalışan verisi:", employee);

      // Get department and position names
      const departmentName = employee.departments?.name || '';
      const positionName = employee.positions?.name || '';

      setFormData({
        ...employee,
        department: departmentName,
        position: positionName,
        notes: employee.notes || '',
      });

      if (employee.photo_url) {
        setPhotoPreview(employee.photo_url);
      }
    }
    fetchDepartments();
    fetchCompanies();
    fetchShifts();
  }, [employee]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase.from('departments').select('id, name');
    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase.from('companies').select('id, name');
    if (!error && data) {
      setCompanies(data);
    } else {
      setCompanies([]);
    }
  };

  const fetchShifts = async () => {
    const { data, error } = await supabase.from('shifts').select('id, name');
    if (!error && data) {
      setShifts(data);
    } else {
      setShifts([]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    // Ön izleme için
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Supabase storage'a yükleme işlemi
    try {
      setIsLoading(true);
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (error) throw error;

      // Yüklenen dosyanın public URL'ini al
      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      setFormData({ ...formData, photo_url: urlData.publicUrl });
    } catch (error) {
      console.error('Fotoğraf yüklenirken hata:', error);
      alert('Fotoğraf yüklenemedi. Lütfen daha sonra tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Form verilerini veritabanı kolonlarıyla eşleştir
      const employeeData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        tc_no: formData.tc_no,
        card_number: formData.card_number,
        photo_url: formData.photo_url,
        is_active: formData.is_active,
        notes: formData.notes,
        company_id: formData.company_id ? Number(formData.company_id) : null,
        shift: formData.shift
      };

      // Departman ve pozisyon için id değerlerini bulma
      if (formData.department) {
        const selectedDept = departments.find(d => d.name === formData.department);
        if (selectedDept) {
          employeeData.department_id = selectedDept.id;
        }
      }

      if (employee) {
        // Güncelleme
        const { data, error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', employee.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      } else {
        // Yeni kayıt
        const { data, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      }
      onClose();
    } catch (error) {
      console.error('Personel kaydedilirken hata:', error);
      alert('Personel kaydedilemedi: ' + (error.message || 'Bilinmeyen hata'));
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
          <FormTextField
            label="Ad"
            name="first_name"
            value={formData.first_name || ''}
            onChange={(value) => setFormData({ ...formData, first_name: value })}
            required
          />
          <FormTextField
            label="Soyad"
            name="last_name"
            value={formData.last_name || ''}
            onChange={(value) => setFormData({ ...formData, last_name: value })}
            required
          />
        </div>

        <FormTextField
          label="TC Kimlik No"
          name="tc_no"
          value={formData.tc_no || ''}
          onChange={(value) => setFormData({ ...formData, tc_no: value })}
          maxLength={11}
          pattern="[0-9]{11}"
          title="TC Kimlik No 11 haneli rakamlardan oluşmalıdır"
          required
        />

        <FormTextField
          label="E-posta"
          name="email"
          type="email"
          value={formData.email || ''}
          onChange={(value) => setFormData({ ...formData, email: value })}
          required
        />

        <FormSelectField
          label="Şirket"
          name="company_id"
          value={formData.company_id?.toString() || ''}
          onChange={(value) => setFormData({ ...formData, company_id: parseInt(value) || null })}
          options={companies}
        />

        <FormSelectField
          label="Departman"
          name="department"
          value={formData.department || ''}
          onChange={(value) => setFormData({ ...formData, department: value })}
          options={departments}
          required
        />

        <FormTextField
          label="Pozisyon"
          name="position"
          value={formData.position || ''}
          onChange={(value) => setFormData({ ...formData, position: value })}
          required
        />

        <FormSelectField
          label="Vardiya"
          name="shift"
          value={formData.shift || ''}
          onChange={(value) => setFormData({ ...formData, shift: value })}
          options={shifts}
        />

        <FormTextField
          label="Kart No"
          name="card_number"
          value={formData.card_number || ''}
          onChange={(value) => setFormData({ ...formData, card_number: value })}
          required
        />

        <FormSelectField
          label="Durum"
          name="is_active"
          value={formData.is_active ? 'active' : 'inactive'}
          onChange={(value) => setFormData({ ...formData, is_active: value === 'active' })}
          options={[
            { id: 1, name: 'active' },
            { id: 0, name: 'inactive' }
          ]}
          required
        />

        <FormTextArea
          label="Açıklama / Notlar"
          name="notes"
          value={formData.notes || ''}
          onChange={(value) => setFormData({ ...formData, notes: value })}
          className="min-h-[80px]"
        />
      </div>

      <FormActions isLoading={isLoading} onClose={onClose} />
    </form>
  );
}
