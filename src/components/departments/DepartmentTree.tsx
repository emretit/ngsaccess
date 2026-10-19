import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useState, useEffect } from "react";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import type { Id } from "../../../convex/_generated/dataModel";

import { Users, UserX } from "lucide-react";
import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { AddDepartmentDialog } from "./AddDepartmentDialog";
import {
  TreePanel,
  TreePanelHeader,
  treeFixedItemClass,
} from "@/components/shared/TreePanel";
import { useDepartments } from "@/hooks/useDepartments";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface DepartmentTreeProps {
  selectedValue?: string;
  onSelectUnassigned?: () => void;
  onSelectDepartment: (id: Id<"departments"> | null) => void;
}

export default function DepartmentTree({
  onSelectDepartment,
  selectedValue,
  onSelectUnassigned,
}: DepartmentTreeProps) {
  const {
    departments,
    isLoading,
    addDepartment,
    deleteDepartment,
    renameDepartment,
  } = useDepartments();
  const { projectId } = useActiveProject();
  const [renameTarget, setRenameTarget] = useState<
    (typeof departments)[number] | null
  >(null);
  const [selectedDepartment, setSelectedDepartment] =
    useState<Id<"departments"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    (typeof departments)[number] | null
  >(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddTopLevelDialog, setShowAddTopLevelDialog] = useState(false);
  const [addingToParentId, setAddingToParentId] =
    useState<Id<"departments"> | null>(null);

  useEffect(() => {
    setSelectedDepartment(null);
    setDeleteTarget(null);
    setRenameTarget(null);
    setShowAddDialog(false);
    setShowAddTopLevelDialog(false);
    setAddingToParentId(null);
  }, [projectId]);

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
    const children = departments.filter(
      (dept) => (dept.parentId ?? null) === parentId,
    );

    if (!children.length) return null;

    return children.map((department) => {
      const hasChildren = departments.some(
        (dept) => dept.parentId === department._id,
      );

      return (
        <DepartmentTreeItem
          key={department._id}
          department={department}
          level={department.level ?? 0}
          isSelected={(selectedValue ?? selectedDepartment) === department._id}
          onSelect={handleSelectDepartment}
          onAddSubDepartment={(parentId) => {
            setAddingToParentId(parentId);
            setShowAddDialog(true);
          }}
          onRename={() => setRenameTarget(department)}
          onDelete={() => setDeleteTarget(department)}
          hasChildren={hasChildren}
        >
          {renderDepartmentTree(department._id)}
        </DepartmentTreeItem>
      );
    });
  };

  return (
    <>
      <TreePanel
        id="employee-departments"
        label="Departmanlar"
        summary={
          selectedValue === "unassigned"
            ? "Atanmamış"
            : (departments.find((d) => d._id === selectedValue)?.name ??
              "Tüm personel")
        }
        header={
          <TreePanelHeader
            title="Departmanlar"
            addLabel="Departman ekle"
            onAddClick={() => setShowAddTopLevelDialog(true)}
          />
        }
        footer="Departman seçildiğinde yalnız doğrudan bağlı kişiler gösterilir."
      >
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                className={treeFixedItemClass}
                aria-pressed={!(selectedValue ?? selectedDepartment)}
                onClick={handleProjectHeaderClick}
              >
                <Users aria-hidden="true" className="mx-[3px] h-3.5 w-3.5 shrink-0" />
                Tüm personel
              </button>
            </li>
            {onSelectUnassigned && (
              <li>
                <button
                  type="button"
                  className={treeFixedItemClass}
                  aria-pressed={selectedValue === "unassigned"}
                  onClick={onSelectUnassigned}
                >
                  <UserX aria-hidden="true" className="mx-[3px] h-3.5 w-3.5 shrink-0" />
                  Atanmamış
                </button>
              </li>
            )}
          </ul>
          <div role="presentation" className="border-t" />
          {isLoading ? (
            <SectionSkeleton label="Departmanlar yükleniyor" />
          ) : departments.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Henüz departman yok. Eklemek için + düğmesini kullanın.
            </p>
          ) : (
            <ul className="space-y-0.5">{renderDepartmentTree()}</ul>
          )}
      </TreePanel>
      <AddDepartmentDialog
        isOpen={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Departmanı yeniden adlandır"
        description={renameTarget?.name}
        successMessage="Departman adı güncellendi"
        onAdd={async (name) => {
          if (!renameTarget) return false;
          await renameDepartment(renameTarget._id, name);
          setRenameTarget(null);
          return true;
        }}
      />
      <ConfirmDestructive
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        confirmLabel="Departmanı sil"
        title="Departman silinsin mi?"
        objectName={deleteTarget?.name ?? ""}
        effects={[
          "Departman kalıcı silinir.",
          "Çalışanı veya alt departmanı varsa işlem engellenir; önce bağlı kayıtları taşıyın.",
        ]}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteDepartment(deleteTarget._id);
          if ((selectedValue ?? selectedDepartment) === deleteTarget._id)
            handleProjectHeaderClick();
        }}
      />
      <AddDepartmentDialog
        key={`${projectId}-${addingToParentId ?? "top"}`}
        isOpen={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddDepartment}
        title="Yeni Departman Ekle"
        description={`${departments.find((d) => d._id === addingToParentId)?.name ?? "Üst seviye"} altına eklenecek departmanın adını girin`}
      />

      <AddDepartmentDialog
        key={projectId}
        isOpen={showAddTopLevelDialog}
        onOpenChange={setShowAddTopLevelDialog}
        onAdd={handleAddTopLevelDepartment}
        title="Yeni Departman Ekle"
        description="Üst seviye departmanın adını girin"
      />
    </>
  );
}
