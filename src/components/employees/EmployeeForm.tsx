'use client';

import { useState, useEffect } from 'react';
import { Employee } from '@/types/employee';
import { supabase } from '@/integrations/supabase/client';
import PhotoUpload from './PhotoUpload';
import FormField from './FormField';
import FormActions from './FormActions';

interface EmployeeFormProps {
  employee?: Employee;
  onClose: () => void;
  onSave: (employee: Employee) => void;
}

export default function EmployeeForm({ employee, onClose, onSave }: EmployeeFormProps) {
  const [formData, setFormData] = useState<Partial<Employee>>({
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    position: '',
    card_no: '',
    status: 'active',
    photo_url: '',
    tc_no: '',
    shift: '',
    company_id: '',
    notes: '',
  });

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      console.log("Yüklenen çalışan verisi:", employee); // Veriyi kontrol için log
      
      // Eğer first_name/last_name yoksa name'den ayıklama yapalım
      let firstName = employee.first_name || '';
      let lastName = employee.last_name || '';
      
      if ((!firstName || !lastName) && (employee.name)) {
        const nameParts = employee.name.split(' ');
        firstName = firstName || nameParts[0] || '';
        lastName = lastName || nameParts.slice(1).join(' ') || '';
      }
      
      setFormData({
        ...employee,
        first_name: firstName,
        last_name: lastName,
        tc_no: employee.tc_no || '',
        shift: employee.shift || '',
        company_id: employee.company_id?.toString() || '',
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
      // Eğer şirket tablosu yoksa boş bir array ile devam et
      setCompanies([]);
    }
  };
  
  const fetchShifts = async () => {
    const { data, error } = await supabase.from('shifts').select('id, name');
    if (!error && data) {
      setShifts(data);
    } else {
      // Eğer vardiya tablosu yoksa boş bir array ile devam et
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
      const employeeData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        tc_no: formData.tc_no,
        card_number: formData.card_no, // card_no yerine card_number
        photo_url: formData.photo_url,
        is_active: formData.status === 'active', // status yerine is_active (boolean)
        notes: formData.notes,
        company_id: formData.company_id ? parseInt(formData.company_id.toString()) : null,
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
          label="E-posta"
          id="email"
          type="email"
          value={formData.email || ''}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <FormField
          label="Şirket"
          id="company_id"
          value={formData.company_id?.toString() || ''}
          onChange={e => setFormData({ ...formData, company_id: e.target.value })}
          options={companies}
        />

        <FormField
          label="Departman"
          id="department"
          value={formData.department || ''}
          onChange={e => setFormData({ ...formData, department: e.target.value })}
          options={departments}
          required
        />

        <FormField
          label="Pozisyon"
          id="position"
          value={formData.position || ''}
          onChange={e => setFormData({ ...formData, position: e.target.value })}
          required
        />

        <FormField
          label="Vardiya"
          id="shift"
          value={formData.shift || ''}
          onChange={e => setFormData({ ...formData, shift: e.target.value })}
          options={shifts}
        />

        <FormField
          label="Kart No"
          id="card_no"
          value={formData.card_no || ''}
          onChange={e => setFormData({ ...formData, card_no: e.target.value })}
          required
        />

        <FormField
          label="Durum"
          id="status"
          value={formData.status || 'active'}
          onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
          options={[
            { id: 'active', name: 'Aktif' },
            { id: 'inactive', name: 'Pasif' }
          ]}
          required
        />

        <FormField
          label="Açıklama / Notlar"
          id="notes"
          value={formData.notes || ''}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          isTextarea
        />
      </div>

      <FormActions isLoading={isLoading} onClose={onClose} />
    </form>
  );
}
