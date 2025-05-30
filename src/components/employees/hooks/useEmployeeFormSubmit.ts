
import { useState } from 'react';
import { Employee } from '@/types/employee';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeFormData } from './useEmployeeFormData';

export function useEmployeeFormSubmit(
  employee: Employee | null | undefined,
  onClose: () => void,
  onSave: (employee: Employee) => void,
  departments: { id: number; name: string }[],
  positions: { id: number; name: string }[]
) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: EmployeeFormData) => {
    setIsLoading(true);

    try {
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

      if (formData.department) {
        const selectedDept = departments.find(d => d.name === formData.department);
        if (selectedDept) {
          employeeData.department_id = selectedDept.id;
        }
      }

      if (formData.position) {
        const selectedPos = positions.find(p => p.name === formData.position);
        if (selectedPos) {
          employeeData.position_id = selectedPos.id;
        }
      }

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

  return {
    isLoading,
    handleSubmit,
  };
}
