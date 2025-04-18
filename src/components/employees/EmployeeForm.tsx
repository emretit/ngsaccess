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
    department_id: 0,
    position_id: null,
    card_number: '',
    is_active: true,
    photo_url: null,
    tc_no: '',
    shift: null,
    company_id: null,
  });

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        is_active: employee.is_active ?? true,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const employeeData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        tc_no: formData.tc_no,
        card_number: formData.card_number,
        photo_url: formData.photo_url,
        is_active: formData.is_active,
        company_id: formData.company_id,
        department_id: formData.department_id,
        position_id: formData.position_id,
        shift_id: formData.shift_id,
        shift: formData.shift,
      };

      if (employee) {
        const { data, error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', employee.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      } else {
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
      </div>

      <FormActions isLoading={isLoading} onClose={onClose} />
    </form>
  );
}
