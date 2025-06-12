
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/types/department";
import { toast } from "sonner";
import { useProjectAccess } from "./useProjectAccess";

export function useDepartments() {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { data: departments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['departments', projectIds],
    queryFn: async (): Promise<Department[]> => {
      let query = supabase
        .from("departments")
        .select("*")
        .order("level", { ascending: true })
        .order("name", { ascending: true });

      // Super admin değilse proje filtrelemesi uygula
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // Kullanıcının hiç projesi yoksa boş sonuç döndür
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching departments:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 10 * 60 * 1000, // 10 dakika boyunca veri fresh kabul edilir (departments çok az değişir)
    gcTime: 30 * 60 * 1000, // 30 dakika cache'de kalır
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const addDepartment = async (name: string, parentId: number | null = null) => {
    if (!name.trim()) return;

    // Yeni departman için proje ID'sini belirle
    const currentProjectId = isSuperAdmin ? 1 : (projectIds.length > 0 ? projectIds[0] : 1);

    const newDepartment = {
      name: name.trim(),
      parent_id: parentId,
      level: parentId ? 
        (departments.find(d => d.id === parentId)?.level || 0) + 1 : 0,
      project_id: currentProjectId
    };

    const { error } = await supabase
      .from("departments")
      .insert(newDepartment);

    if (error) {
      console.error("Error adding department:", error);
      toast.error("Departman eklenirken bir hata oluştu");
      return false;
    }

    toast.success("Departman başarıyla eklendi");
    await refetch();
    return true;
  };

  const deleteDepartment = async (id: number) => {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting department:", error);
      toast.error("Departman silinirken bir hata oluştu");
      return false;
    }

    toast.success("Departman başarıyla silindi");
    await refetch();
    return true;
  };

  return {
    departments,
    isLoading: isLoading || projectLoading,
    error,
    addDepartment,
    deleteDepartment,
    fetchDepartments: refetch
  };
}
