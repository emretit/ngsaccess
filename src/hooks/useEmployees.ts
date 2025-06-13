
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/employee';
import { useProjectAccess } from './useProjectAccess';

export const useEmployees = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { data: employees = [], isLoading, error, refetch } = useQuery({
    queryKey: ['employees', projectIds],
    queryFn: async (): Promise<Employee[]> => {
      console.log('Fetching employees for projects:', projectIds);
      
      let query = supabase
        .from('employees')
        .select(`
          *,
          departments (id, name),
          positions (id, name)
        `)
        .order('created_at', { ascending: false });

      // Super admin değilse proje filtrelemesi uygula
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // Kullanıcının hiç projesi yoksa boş sonuç döndür
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching employees:', error);
        throw error;
      }

      // Veritabanından gelen veriyi Employee tipine uygun hale getir
      return (data || []).map((employee: any) => ({
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        tc_no: employee.tc_no,
        card_number: employee.card_number,
        access_permission: employee.access_permission,
        photo_url: employee.photo_url,
        shift: employee.shift,
        company_id: employee.company_id,
        department_id: employee.department_id,
        position_id: employee.position_id,
        shift_id: employee.shift_id,
        access_rule_id: employee.access_rule_id || null,
        access_rule: employee.access_rule || '',
        created_at: employee.created_at,
        updated_at: employee.updated_at,
        is_active: employee.is_active,
        notes: employee.notes || '',
        departments: employee.departments,
        positions: employee.positions
      } as Employee));
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 5 * 60 * 1000, // 5 dakika boyunca veri fresh kabul edilir
    gcTime: 10 * 60 * 1000, // 10 dakika cache'de kalır
    refetchOnWindowFocus: false, // Pencere focus'a geldiğinde yeniden fetch etme
    refetchOnMount: false, // Component mount olduğunda cache varsa yeniden fetch etme
    retry: 1, // Hata durumunda sadece 1 kez retry
  });

  return {
    employees,
    isLoading: isLoading || projectLoading,
    error,
    refetch,
    // Loading sırasında hasProjectAccess true dönsün ki "Proje Erişimi Yok" mesajı görünmesin
    hasProjectAccess: projectLoading || isSuperAdmin || projectIds.length > 0
  };
};
