
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/types/department";
import { toast } from "sonner";
import { useProjectAccess } from "./useProjectAccess";

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const fetchDepartments = async () => {
    if (projectLoading) return;
    
    try {
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
        setDepartments([]);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching departments:", error);
        toast.error("Departman listesi alınamadı");
        return;
      }

      setDepartments(data || []);
    } catch (error) {
      console.error("Error in fetchDepartments:", error);
      toast.error("Departman listesi alınamadı");
    }
  };

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
    await fetchDepartments();
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
    await fetchDepartments();
    return true;
  };

  useEffect(() => {
    if (!projectLoading) {
      fetchDepartments();
    }
  }, [projectIds, isSuperAdmin, projectLoading]);

  return {
    departments,
    addDepartment,
    deleteDepartment,
    fetchDepartments
  };
}
