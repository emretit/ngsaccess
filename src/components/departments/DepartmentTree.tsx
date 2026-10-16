import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { AddDepartmentDialog } from "./AddDepartmentDialog";
import { DepartmentProjectHeader } from "./DepartmentProjectHeader";
import { useDepartments } from "@/hooks/useDepartments";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface DepartmentTreeProps {
  onSelectDepartment: (id: Id<"departments"> | null) => void;
}

export default function DepartmentTree({ onSelectDepartment }: DepartmentTreeProps) {
  const { departments, isLoading, addDepartment, deleteDepartment } = useDepartments();
  const { activeProject, isSuperAdmin, projectId, loading: projectLoading } = useActiveProject();
  const [selectedDepartment, setSelectedDepartment] = useState<Id<"departments"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(typeof departments)[number] | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddTopLevelDialog, setShowAddTopLevelDialog] = useState(false);
  const [addingToParentId, setAddingToParentId] = useState<Id<"departments"> | null>(null);

  useEffect(() => {
    setSelectedDepartment(null);
    onSelectDepartment(null);
    setDeleteTarget(null);
    setShowAddDialog(false);
    setShowAddTopLevelDialog(false);
    setAddingToParentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const generalSettings = useQuery(
    api.settings.getGeneral,
    !projectLoading && projectId ? { projectId } : "skip",
  );
  const companyName = isSuperAdmin
    ? (activeProject?.name ?? "Proje seç")
    : (generalSettings?.companyName ?? activeProject?.name ?? "Ana Proje");

  const handleProjectHeaderClick = () => {
    setSelectedDepartment(null);
    onSelectDepartment(null);
  };

  const handleSelectDepartment = (id: Id<"departments">) => {
    setSelectedDepartment(id);
    onSelectDepartment(id);
  };

  const handleAddDepartment = async (name: string) => {
    const success = await addDepartment(name, addingToParentId);
    if (success) {
      setShowAddDialog(false);
      setAddingToParentId(null);
    }
    return success;
  };

  const handleAddTopLevelDepartment = async (name: string) => {
    const success = await addDepartment(name, null);
    if (success) {
      setShowAddTopLevelDialog(false);
    }
    return success;
  };

  const renderDepartmentTree = (parentId: Id<"departments"> | null = null) => {
    const children = departments.filter(dept => (dept.parentId ?? null) === parentId);

    if (!children.length) return null;

    return children.map(department => {
      const hasChildren = departments.some(dept => dept.parentId === department._id);

      return (
        <DepartmentTreeItem
          key={department._id}
          department={department}
          level={department.level ?? 0}
          isSelected={selectedDepartment === department._id}
          onSelect={handleSelectDepartment}
          onAddSubDepartment={(parentId) => {
            setAddingToParentId(parentId);
            setShowAddDialog(true);
          }}
          onDelete={() => setDeleteTarget(department)}
          hasChildren={hasChildren}
        >
          {renderDepartmentTree(department._id)}
        </DepartmentTreeItem>
      );
    });
  };

  return (
    <div className="h-full w-full md:w-[220px] shrink-0 bg-card rounded-xl border shadow-xs">
      <DepartmentProjectHeader
        projectName={companyName}
        onProjectClick={handleProjectHeaderClick}
        onAddClick={() => setShowAddTopLevelDialog(true)}
      />

      <div className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {isLoading ? (
          <SectionSkeleton label="Departmanlar yükleniyor" />
        ) : departments.length === 0 ? (
          <EmptyState title="Departman yok" />
        ) : (
          <ul role="tree" className="space-y-0.5">
            {renderDepartmentTree()}
          </ul>
        )}
      </div>

      <ConfirmDestructive open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        confirmLabel="Departmanı sil" title="Departman silinsin mi?" objectName={deleteTarget?.name ?? ""}
        effects={["Departman kalıcı silinir.", "Çalışanı veya alt departmanı varsa işlem engellenir; önce bağlı kayıtları taşıyın."]}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteDepartment(deleteTarget._id);
          if (selectedDepartment === deleteTarget._id) handleProjectHeaderClick();
        }} />
      <AddDepartmentDialog key={`${projectId}-${addingToParentId ?? "top"}`}
        isOpen={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddDepartment}
        title="Yeni Departman Ekle"
        description={addingToParentId ? "Alt departmanın adını girin" : "Yeni departmanın adını girin"}
      />

      <AddDepartmentDialog key={projectId}
        isOpen={showAddTopLevelDialog}
        onOpenChange={setShowAddTopLevelDialog}
        onAdd={handleAddTopLevelDepartment}
        title="Yeni Departman Ekle"
        description="Üst seviye departmanın adını girin"
      />
    </div>
  );
}
