
import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { Department } from "@/types/department";

interface DepartmentTreeProps {
  onSelectDepartment: (id: number | null) => void;
}

export default function DepartmentTree({ onSelectDepartment }: DepartmentTreeProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [addingToParentId, setAddingToParentId] = useState<number | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

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

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) return;

    const newDepartment = {
      name: newDepartmentName.trim(),
      parent_id: addingToParentId,
      level: addingToParentId ? 
        (departments.find(d => d.id === addingToParentId)?.level || 0) + 1 : 0
    };

    const { error } = await supabase
      .from("departments")
      .insert(newDepartment);

    if (error) {
      toast.error("Departman eklenirken bir hata oluştu");
      return;
    }

    toast.success("Departman başarıyla eklendi");
    setNewDepartmentName("");
    setShowAddDialog(false);
    fetchDepartments();
  };

  const handleDeleteDepartment = async (id: number) => {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Departman silinirken bir hata oluştu");
      return;
    }

    toast.success("Departman başarıyla silindi");
    if (selectedDepartment === id) {
      setSelectedDepartment(null);
      onSelectDepartment(null);
    }
    fetchDepartments();
  };

  const handleSelectDepartment = (id: number) => {
    setSelectedDepartment(id);
    onSelectDepartment(id);
  };

  const renderDepartmentTree = (parentId: number | null = null): React.ReactNode => {
    const children = departments.filter(dept => dept.parent_id === parentId);
    
    if (!children.length) return null;

    return children.map(department => {
      const hasChildren = departments.some(dept => dept.parent_id === department.id);
      
      return (
        <DepartmentTreeItem
          key={department.id}
          department={department}
          level={department.level}
          isSelected={selectedDepartment === department.id}
          onSelect={handleSelectDepartment}
          onAddSubDepartment={(parentId) => {
            setAddingToParentId(parentId);
            setShowAddDialog(true);
          }}
          onDelete={handleDeleteDepartment}
          hasChildren={hasChildren}
        >
          {renderDepartmentTree(department.id)}
        </DepartmentTreeItem>
      );
    });
  };

  return (
    <div className="h-full w-[280px] overflow-auto rounded-2xl bg-card p-4">
      <ul role="tree" className="space-y-0.5">
        {renderDepartmentTree()}
      </ul>

      <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Yeni Departman Ekle</AlertDialogTitle>
            <AlertDialogDescription>
              {addingToParentId
                ? `Alt departmanın adını girin`
                : "Yeni departmanın adını girin"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            placeholder="Departman adı"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setNewDepartmentName("");
              setShowAddDialog(false);
            }}>
              İptal
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddDepartment}>
              Ekle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
