
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { AddDepartmentDialog } from "./AddDepartmentDialog";
import { DepartmentProjectHeader } from "./DepartmentProjectHeader";
import { useDepartments } from "@/hooks/useDepartments";

interface DepartmentTreeProps {
  onSelectDepartment: (id: number | null) => void;
}

export default function DepartmentTree({ onSelectDepartment }: DepartmentTreeProps) {
  const { departments, addDepartment, deleteDepartment } = useDepartments();
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddTopLevelDialog, setShowAddTopLevelDialog] = useState(false);
  const [addingToParentId, setAddingToParentId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("Ana Proje");

  useEffect(() => {
    fetchProjectName();
  }, []);

  const fetchProjectName = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("name")
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Error fetching project name:", error);
      return;
    }

    if (data) {
      setProjectName(data.name);
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
        projectName={projectName}
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
