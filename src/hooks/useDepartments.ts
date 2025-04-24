
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/types/department";
import { toast } from "sonner";

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("level", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast.error("Departman listesi alınamadı");
      return;
    }

    setDepartments(data || []);
  };

  const addDepartment = async (name: string, parentId: number | null = null) => {
    if (!name.trim()) return;

    const newDepartment = {
      name: name.trim(),
      parent_id: parentId,
      level: parentId ? 
        (departments.find(d => d.id === parentId)?.level || 0) + 1 : 0
    };

    const { error } = await supabase
      .from("departments")
      .insert(newDepartment);

    if (error) {
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
      toast.error("Departman silinirken bir hata oluştu");
      return false;
    }

    toast.success("Departman başarıyla silindi");
    await fetchDepartments();
    return true;
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  return {
    departments,
    addDepartment,
    deleteDepartment,
    fetchDepartments
  };
}
