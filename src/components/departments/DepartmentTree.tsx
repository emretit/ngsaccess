import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { AddDepartmentDialog } from "./AddDepartmentDialog";
import { DepartmentProjectHeader } from "./DepartmentProjectHeader";
import { useDepartments } from "@/hooks/useDepartments";
import { useProjectAccess } from "@/hooks/useProjectAccess";

interface DepartmentTreeProps {
  onSelectDepartment: (id: number | null) => void;
}

export default function DepartmentTree({ onSelectDepartment }: DepartmentTreeProps) {
  const { departments, addDepartment, deleteDepartment } = useDepartments();
  const { projectIds, isSuperAdmin } = useProjectAccess();
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddTopLevelDialog, setShowAddTopLevelDialog] = useState(false);
  const [addingToParentId, setAddingToParentId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("Ana Proje");

  useEffect(() => {
    fetchCompanyName();
  }, [projectIds, isSuperAdmin]);

  const fetchCompanyName = async () => {
    try {
      if (isSuperAdmin) {
        setCompanyName("Tüm Projeler");
        return;
      }

      // Fetch company name from general_settings instead of companies table
      const { data: settings, error } = await supabase
        .from("general_settings")
        .select("company_name")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching company name:", error);
        setCompanyName("Şirket");
        return;
      }

      if (settings && settings.company_name) {
        setCompanyName(settings.company_name);
      } else {
        setCompanyName("Şirket Bulunamadı");
      }
    } catch (error) {
      console.error("Error in fetchCompanyName:", error);
      setCompanyName("Ana Proje");
    }
  };

  const handleProjectHeaderClick = () => {
    setSelectedDepartment(null);
    onSelectDepartment(null);
  };

  const handleSelectDepartment = (id: number) => {
    setSelectedDepartment(id);
    onSelectDepartment(id);
  };

  const handleAddDepartment = async (name: string) => {
    const success = await addDepartment(name, addingToParentId);
    if (success) {
      setShowAddDialog(false);
      setAddingToParentId(null);
    }
  };

  const handleAddTopLevelDepartment = async (name: string) => {
    const success = await addDepartment(name, null);
    if (success) {
      setShowAddTopLevelDialog(false);
    }
  };

  const renderDepartmentTree = (parentId: number | null = null) => {
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
          onDelete={deleteDepartment}
          hasChildren={hasChildren}
        >
          {renderDepartmentTree(department.id)}
        </DepartmentTreeItem>
      );
    });
  };

  return (
    <div className="h-full w-[280px] bg-card rounded-lg border shadow">
      <DepartmentProjectHeader
        projectName={companyName}
        onProjectClick={handleProjectHeaderClick}
        onAddClick={() => setShowAddTopLevelDialog(true)}
      />
      
      <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <ul role="tree" className="space-y-0.5">
          {renderDepartmentTree()}
        </ul>
      </div>

      <AddDepartmentDialog
        isOpen={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddDepartment}
        title="Yeni Departman Ekle"
        description={addingToParentId ? "Alt departmanın adını girin" : "Yeni departmanın adını girin"}
      />

      <AddDepartmentDialog
        isOpen={showAddTopLevelDialog}
        onOpenChange={setShowAddTopLevelDialog}
        onAdd={handleAddTopLevelDepartment}
        title="Yeni Departman Ekle"
        description="Üst seviye departmanın adını girin"
      />
    </div>
  );
}
