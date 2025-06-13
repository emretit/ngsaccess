
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

      // Ensure access_rule_id is included in the returned data
      return (data || []).map(employee => ({
        ...employee,
        access_rule_id: employee.access_rule_id || null
      }));
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
