import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/employee';

export interface EmployeeFormData {
  first_name: string;
  last_name: string;
  email: string;
  tc_no: string;
  card_number: string;
  company_id: number | null;
  department_id: number | null;
  position_id: number | null;
  access_rule_id: number | null;
  shift: string | null;
  shift_id: number | null;
  photo_url: string | null;
  notes: string;
  is_active: boolean;
}

export const useEmployeeFormData = (employee?: Employee | null) => {
  const [formData, setFormData] = useState<EmployeeFormData>({
    first_name: '',
    last_name: '',
    email: '',
    tc_no: '',
    card_number: '',
    company_id: null,
    department_id: null,
    position_id: null,
    access_rule_id: null,
    shift: null,
    shift_id: null,
    photo_url: null,
    notes: '',
    is_active: true,
  });

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [accessRules, setAccessRules] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Initialize form data when employee prop changes
  useEffect(() => {
    if (employee) {
      console.log('Initializing form with employee data:', employee);
      setFormData({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        tc_no: employee.tc_no || '',
        card_number: employee.card_number || '',
        company_id: employee.company_id || null,
        department_id: employee.department_id || null,
        position_id: employee.position_id || null,
        access_rule_id: employee.access_rule_id || null,
        shift: employee.shift || null,
        shift_id: employee.shift_id || null,
        photo_url: employee.photo_url || null,
        notes: employee.notes || '',
        is_active: employee.is_active ?? true,
      });
      setPhotoPreview(employee.photo_url || null);
    } else {
      // Reset form for new employee
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        tc_no: '',
        card_number: '',
        company_id: null,
        department_id: null,
        position_id: null,
        access_rule_id: null,
        shift: null,
        shift_id: null,
        photo_url: null,
        notes: '',
        is_active: true,
      });
      setPhotoPreview(null);
    }
  }, [employee]);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setDepartments(data || []);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setCompanies(data || []);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };

    fetchCompanies();
  }, []);

  // Fetch access rules
  useEffect(() => {
    const fetchAccessRules = async () => {
      try {
        const { data, error } = await supabase
          .from('access_rules')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setAccessRules(data || []);
      } catch (error) {
        console.error('Error fetching access rules:', error);
      }
    };

    fetchAccessRules();
  }, []);

  // Fetch positions
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase
          .from('positions')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setPositions(data || []);
      } catch (error) {
        console.error('Error fetching positions:', error);
      }
    };

    fetchPositions();
  }, []);

  return {
    formData,
    setFormData,
    departments,
    companies,
    accessRules,
    positions,
    photoPreview,
    setPhotoPreview,
  };
};
