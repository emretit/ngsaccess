
import { useState, useEffect } from 'react';
import { Employee } from '@/types/employee';
import { supabase } from '@/integrations/supabase/client';

export type EmployeeFormData = Partial<Employee> & {
  department?: string;
  position?: string;
  notes?: string;
  department_id?: number | null;
  position_id?: number | null;
};

export function useEmployeeFormData(employee?: Employee | null) {
  const [formData, setFormData] = useState<EmployeeFormData>({
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
    department_id: null,
    position_id: null,
  });

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      console.log("Yüklenen çalışan verisi:", employee);

      const departmentName = employee.departments?.name || '';
      const positionName = employee.positions?.name || '';

      setFormData({
        ...employee,
        department: departmentName,
        position: positionName,
        department_id: employee.department_id,
        position_id: employee.position_id,
        notes: employee.notes || '',
      });

      if (employee.photo_url) {
        setPhotoPreview(employee.photo_url);
      }
    }
    fetchDepartments();
    fetchCompanies();
    fetchShifts();
    fetchPositions();
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

  const fetchPositions = async () => {
    const { data, error } = await supabase.from('positions').select('id, name');
    if (!error && data) {
      setPositions(data);
    } else {
      setPositions([]);
    }
  };

  return {
    formData,
    setFormData,
    departments,
    companies,
    shifts,
    positions,
    photoPreview,
    setPhotoPreview,
  };
}
