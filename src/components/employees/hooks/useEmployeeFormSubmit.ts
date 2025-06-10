
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Employee } from '@/types/employee';
import { EmployeeFormData } from './useEmployeeFormData';

export const useEmployeeFormSubmit = (
  employee: Employee | null | undefined,
  onClose: () => void,
  onSave: (employee: Employee) => void,
  departments: { id: number; name: string }[],
  positions: { id: number; name: string }[]
) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: EmployeeFormData) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      console.log('=== EMPLOYEE FORM SUBMIT ===');
      console.log('Employee data:', employee);
      console.log('Form data:', formData);
      console.log('Is editing:', !!employee);

      // Validation
      if (!formData.first_name?.trim()) {
        toast({
          title: "Hata",
          description: "Ad alanı zorunludur",
          variant: "destructive",
        });
        return;
      }

      if (!formData.last_name?.trim()) {
        toast({
          title: "Hata", 
          description: "Soyad alanı zorunludur",
          variant: "destructive",
        });
        return;
      }

      if (!formData.email?.trim()) {
        toast({
          title: "Hata",
          description: "E-posta alanı zorunludur", 
          variant: "destructive",
        });
        return;
      }

      if (!formData.tc_no?.trim() || formData.tc_no.length !== 11) {
        toast({
          title: "Hata",
          description: "TC Kimlik No 11 haneli olmalıdır",
          variant: "destructive",
        });
        return;
      }

      if (!formData.card_number?.trim()) {
        toast({
          title: "Hata",
          description: "Kart numarası zorunludur",
          variant: "destructive",
        });
        return;
      }

      // Prepare the data for submission
      const submitData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        tc_no: formData.tc_no.trim(),
        card_number: formData.card_number.trim(),
        company_id: formData.company_id || null,
        department_id: formData.department_id || null,
        position_id: formData.position_id || null,
        shift: formData.shift || null,
        shift_id: formData.shift_id || null,
        photo_url: formData.photo_url || null,
        notes: formData.notes?.trim() || null,
        is_active: formData.is_active ?? true,
        access_permission: formData.access_permission ?? true,
      };

      console.log('Submit data prepared:', submitData);

      let result;
      
      if (employee?.id) {
        // Update existing employee
        console.log('Updating employee with ID:', employee.id);
        result = await supabase
          .from('employees')
          .update(submitData)
          .eq('id', employee.id)
          .select('*')
          .single();
      } else {
        // Create new employee - check for duplicates first
        console.log('Checking for existing employee with same TC or card number...');
        
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('id, tc_no, card_number, email')
          .or(`tc_no.eq.${submitData.tc_no},card_number.eq.${submitData.card_number},email.eq.${submitData.email}`)
          .maybeSingle();

        if (existingEmployee) {
          let errorMessage = 'Bu kayıt zaten mevcut: ';
          if (existingEmployee.tc_no === submitData.tc_no) {
            errorMessage += 'TC Kimlik No';
          } else if (existingEmployee.card_number === submitData.card_number) {
            errorMessage += 'Kart Numarası';
          } else if (existingEmployee.email === submitData.email) {
            errorMessage += 'E-posta';
          }
          
          toast({
            title: "Hata",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }

        console.log('Creating new employee...');
        result = await supabase
          .from('employees')
          .insert([submitData])
          .select('*')
          .single();
      }

      console.log('Database operation result:', result);

      if (result.error) {
        console.error('Database error:', result.error);
        throw result.error;
      }

      if (!result.data) {
        throw new Error('No data returned from database operation');
      }

      toast({
        title: "Başarılı",
        description: employee?.id ? "Çalışan bilgileri güncellendi" : "Yeni çalışan eklendi",
      });

      console.log('Operation successful, calling onSave with:', result.data);
      onSave(result.data);
      onClose();

    } catch (error: any) {
      console.error('Form submission error:', error);
      
      let errorMessage = "Bir hata oluştu";
      
      if (error?.code === '23505') {
        if (error.constraint?.includes('tc_no')) {
          errorMessage = "Bu TC Kimlik No zaten kullanılıyor";
        } else if (error.constraint?.includes('card_number')) {
          errorMessage = "Bu kart numarası zaten kullanılıyor"; 
        } else if (error.constraint?.includes('email')) {
          errorMessage = "Bu e-posta adresi zaten kullanılıyor";
        } else {
          errorMessage = "Bu kayıt zaten mevcut";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Hata",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleSubmit
  };
};
