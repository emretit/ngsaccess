
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

      return data || [];
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
  });

  return {
    employees,
    isLoading: isLoading || projectLoading,
    error,
    refetch,
    hasProjectAccess: isSuperAdmin || projectIds.length > 0
  };
};
