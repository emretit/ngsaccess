import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useState } from "react";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import type { Id } from "../../../convex/_generated/dataModel";

import { Briefcase, Plus, Users, UserX } from "lucide-react";
import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { CompanyTreeItem } from "./CompanyTreeItem";
import { AddDepartmentDialog } from "./AddDepartmentDialog";
import { CompanyDialog } from "./CompanyDialog";
import { MoveDepartmentDialog } from "./MoveDepartmentDialog";
import {
  TREE_ICON_BUTTON,
  TREE_NAME_BUTTON,
  TREE_ROW_ACTIONS,
  TreePanel,
  TreePanelHeader,
  treeFixedItemClass,
} from "@/components/shared/TreePanel";
import { RowActions } from "@/components/shared/RowActions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDepartments } from "@/hooks/useDepartments";
import { useCompanies, usePositions, type Company, type Position } from "@/hooks/useOrgUnits";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { cn } from "@/lib/utils";
import type { Department } from "@/types/department";

interface DepartmentTreeProps {
  /** Seçili departman ya da "unassigned". */
  selectedValue?: string;
  selectedCompany?: string;
  selectedPosition?: string;
  onSelectUnassigned?: () => void;
  onSelectDepartment: (id: Id<"departments"> | null) => void;
  onSelectCompany?: (id: Id<"companies">) => void;
  onSelectPosition?: (id: Id<"positions"> | null) => void;
}

/** Kişiler sol paneli: Şirket → Departman ağacı ve altında Pozisyonlar. */
export default function DepartmentTree(props: DepartmentTreeProps) {
  const { projectId } = useActiveProject();
  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col gap-3 min-[1100px]:w-[220px]">
      <OrgTree key={`org-${projectId ?? "none"}`} {...props} />
      {props.onSelectPosition && (
        <PositionPanel key={`positions-${projectId ?? "none"}`} selected={props.selectedPosition} onSelect={props.onSelectPosition} />
      )}
    </div>
  );
}

type OrgDialog =
  | { type: "addCompany" }
  | { type: "editCompany"; company: Company }
  | { type: "deleteCompany"; company: Company }
  | { type: "addDepartment"; parent: Department | null; company: Company | null }
  | { type: "renameDepartment"; department: Department }
  | { type: "deleteDepartment"; department: Department }
  | { type: "moveDepartment"; department: Department };

function OrgTree({
  selectedValue,
  selectedCompany,
  onSelectUnassigned,
  onSelectDepartment,
  onSelectCompany,
}: DepartmentTreeProps) {
  const { departments, isLoading, addDepartment, deleteDepartment, renameDepartment, moveDepartmentToCompany } = useDepartments();
  const { companies: companyRows, isLoading: companiesLoading, addCompany, updateCompany, deleteCompany } = useCompanies();
  const companies = [...companyRows].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const [dialog, setDialog] = useState<OrgDialog | null>(null);
  const close = () => setDialog(null);

  const renderDepartments = (parentId: Id<"departments"> | null, companyId: Id<"companies"> | null) =>
    departments
      // Alt departmanlar üstünün şirketini taşır; şirket eşlemesi yalnız üst seviyede yapılır.
      .filter((dept) => (dept.parentId ?? null) === parentId && (parentId !== null || (dept.companyId ?? null) === companyId))
      .map((department) => {
        const hasChildren = departments.some((dept) => dept.parentId === department._id);
        return (
          <DepartmentTreeItem
            key={department._id}
            department={department}
            level={department.level ?? 0}
            isSelected={selectedValue === department._id}
            onSelect={onSelectDepartment}
            onAddSubDepartment={() => setDialog({ type: "addDepartment", parent: department, company: null })}
            onRename={() => setDialog({ type: "renameDepartment", department })}
            onMoveToCompany={!department.parentId && (companies.length > 0 || department.companyId)
              ? () => setDialog({ type: "moveDepartment", department })
              : undefined}
            onDelete={() => setDialog({ type: "deleteDepartment", department })}
            hasChildren={hasChildren}
          >
            {renderDepartments(department._id, null)}
          </DepartmentTreeItem>
        );
      });

  const selectedCompanyRow = companies.find((company) => company._id === selectedCompany);
  const looseDepartments = renderDepartments(null, null);
  const addingDepartment = dialog?.type === "addDepartment" ? dialog : null;

  return (
    <>
      <TreePanel
        id="employee-departments"
        label="Şirketler ve departmanlar"
        summary={
          selectedValue === "unassigned"
            ? "Atanmamış"
            : (selectedCompanyRow?.name ?? departments.find((d) => d._id === selectedValue)?.name ?? "Tüm personel")
        }
        header={
          <TreePanelHeader title="Şirketler ve departmanlar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={TREE_ICON_BUTTON} aria-label="Şirket veya departman ekle">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog({ type: "addCompany" })}>Şirket ekle</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog({ type: "addDepartment", parent: null, company: null })}>
                  {companies.length ? "Şirketsiz departman ekle" : "Departman ekle"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TreePanelHeader>
        }
        footer="Şirket seçilince şirketin tüm kişileri, departman seçilince yalnız doğrudan bağlı kişiler gösterilir."
      >
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              className={treeFixedItemClass}
              aria-pressed={!selectedValue && !selectedCompany}
              onClick={() => onSelectDepartment(null)}
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
        {isLoading || companiesLoading ? (
          <SectionSkeleton label="Şirketler ve departmanlar yükleniyor" />
        ) : departments.length === 0 && companies.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Henüz şirket veya departman yok. Eklemek için + düğmesini kullanın.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {companies.map((company) => {
              const children = renderDepartments(null, company._id);
              return (
                <CompanyTreeItem
                  key={company._id}
                  name={company.name}
                  isSelected={selectedCompany === company._id}
                  hasChildren={children.length > 0}
                  onSelect={() => onSelectCompany?.(company._id)}
                  onAddDepartment={() => setDialog({ type: "addDepartment", parent: null, company })}
                  onEdit={() => setDialog({ type: "editCompany", company })}
                  onDelete={() => setDialog({ type: "deleteCompany", company })}
                >
                  {children}
                </CompanyTreeItem>
              );
            })}
            {looseDepartments}
          </ul>
        )}
      </TreePanel>
      {(dialog?.type === "addCompany" || dialog?.type === "editCompany") && (
        <CompanyDialog
          open
          onOpenChange={(open) => { if (!open) close(); }}
          company={dialog.type === "editCompany" ? dialog.company : null}
          onSave={(details) => dialog.type === "editCompany" ? updateCompany(dialog.company._id, details) : addCompany(details)}
        />
      )}
      <ConfirmDestructive
        open={dialog?.type === "deleteCompany"}
        onOpenChange={(open) => { if (!open) close(); }}
        confirmLabel="Şirketi sil"
        title="Şirket silinsin mi?"
        objectName={dialog?.type === "deleteCompany" ? dialog.company.name : ""}
        effects={[
          "Şirket kalıcı silinir.",
          "Bağlı kişi veya departman varsa işlem engellenir; önce bağlı kayıtları taşıyın.",
        ]}
        onConfirm={async () => {
          if (dialog?.type !== "deleteCompany") return;
          await deleteCompany(dialog.company._id);
          if (selectedCompany === dialog.company._id) onSelectDepartment(null);
        }}
      />
      <AddDepartmentDialog
        key={addingDepartment ? `${addingDepartment.parent?._id ?? addingDepartment.company?._id ?? "top"}` : "closed"}
        isOpen={addingDepartment !== null}
        onOpenChange={(open) => { if (!open) close(); }}
        onAdd={(name) => addDepartment(name, addingDepartment?.parent?._id ?? null, addingDepartment?.company?._id ?? null)}
        title="Yeni Departman Ekle"
        description={
          addingDepartment?.parent
            ? `${addingDepartment.parent.name} altına eklenecek departmanın adını girin`
            : addingDepartment?.company
              ? `${addingDepartment.company.name} şirketine eklenecek departmanın adını girin`
              : companies.length ? "Şirkete bağlı olmayan departmanın adını girin" : "Üst seviye departmanın adını girin"
        }
      />
      <AddDepartmentDialog
        key={dialog?.type === "renameDepartment" ? dialog.department._id : "rename"}
        isOpen={dialog?.type === "renameDepartment"}
        onOpenChange={(open) => { if (!open) close(); }}
        title="Departmanı yeniden adlandır"
        description={dialog?.type === "renameDepartment" ? dialog.department.name : undefined}
        initialName={dialog?.type === "renameDepartment" ? dialog.department.name : ""}
        successMessage="Departman adı güncellendi"
        errorMessage="Departman adı güncellenemedi"
        submitLabel="Kaydet"
        busyLabel="Kaydediliyor…"
        onAdd={async (name) => {
          if (dialog?.type !== "renameDepartment") return false;
          return renameDepartment(dialog.department._id, name);
        }}
      />
      <ConfirmDestructive
        open={dialog?.type === "deleteDepartment"}
        onOpenChange={(open) => { if (!open) close(); }}
        confirmLabel="Departmanı sil"
        title="Departman silinsin mi?"
        objectName={dialog?.type === "deleteDepartment" ? dialog.department.name : ""}
        effects={[
          "Departman kalıcı silinir.",
          "Çalışanı veya alt departmanı varsa işlem engellenir; önce bağlı kayıtları taşıyın.",
        ]}
        onConfirm={async () => {
          if (dialog?.type !== "deleteDepartment") return;
          await deleteDepartment(dialog.department._id);
          if (selectedValue === dialog.department._id) onSelectDepartment(null);
        }}
      />
      <MoveDepartmentDialog
        key={dialog?.type === "moveDepartment" ? dialog.department._id : "move"}
        department={dialog?.type === "moveDepartment" ? dialog.department : null}
        companies={companies}
        onOpenChange={(open) => { if (!open) close(); }}
        onMove={moveDepartmentToCompany}
      />
    </>
  );
}

type PositionDialog = { type: "add" } | { type: "rename"; position: Position } | { type: "delete"; position: Position };

function PositionPanel({ selected, onSelect }: { selected?: string; onSelect: (id: Id<"positions"> | null) => void }) {
  const { positions: rows, isLoading, addPosition, renamePosition, deletePosition } = usePositions();
  const positions = [...rows].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const [dialog, setDialog] = useState<PositionDialog | null>(null);
  const close = () => setDialog(null);
  return (
    <>
      <TreePanel
        id="employee-positions"
        label="Pozisyonlar"
        summary={positions.find((position) => position._id === selected)?.name ?? "Tüm pozisyonlar"}
        header={<TreePanelHeader title="Pozisyonlar" addLabel="Pozisyon ekle" onAddClick={() => setDialog({ type: "add" })} />}
      >
        <ul className="space-y-0.5">
          <li>
            <button type="button" className={treeFixedItemClass} aria-pressed={!selected} onClick={() => onSelect(null)}>
              <Briefcase aria-hidden="true" className="mx-[3px] h-3.5 w-3.5 shrink-0" />
              Tüm pozisyonlar
            </button>
          </li>
        </ul>
        <div role="presentation" className="border-t" />
        {isLoading ? (
          <SectionSkeleton label="Pozisyonlar yükleniyor" />
        ) : positions.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Henüz pozisyon yok. Eklemek için + düğmesini kullanın.</p>
        ) : (
          <ul className="space-y-0.5">
            {positions.map((position) => {
              const isSelected = selected === position._id;
              return (
                <li key={position._id}>
                  <div className={cn("group flex min-w-0 items-center rounded-sm", isSelected ? "bg-selected text-primary" : "hover:bg-muted")}>
                    <span aria-hidden="true" className="w-5 shrink-0" />
                    <button type="button" className={cn(TREE_NAME_BUTTON, isSelected && "font-medium")} aria-pressed={isSelected} onClick={() => onSelect(position._id)}>
                      {position.name}
                    </button>
                    <div className={TREE_ROW_ACTIONS}>
                      <RowActions label={`${position.name} işlemleri`}>
                        <DropdownMenuItem onSelect={() => setDialog({ type: "rename", position })}>Yeniden adlandır</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDialog({ type: "delete", position })}>Sil</DropdownMenuItem>
                      </RowActions>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </TreePanel>
      <AddDepartmentDialog
        key={dialog?.type === "rename" ? dialog.position._id : "add-position"}
        isOpen={dialog?.type === "add" || dialog?.type === "rename"}
        onOpenChange={(open) => { if (!open) close(); }}
        title={dialog?.type === "rename" ? "Pozisyonu yeniden adlandır" : "Yeni pozisyon"}
        description={dialog?.type === "rename" ? dialog.position.name : "Pozisyonun adını girin"}
        fieldLabel="Pozisyon adı"
        initialName={dialog?.type === "rename" ? dialog.position.name : ""}
        successMessage={dialog?.type === "rename" ? "Pozisyon adı güncellendi" : "Pozisyon eklendi"}
        errorMessage={dialog?.type === "rename" ? "Pozisyon adı güncellenemedi" : "Pozisyon eklenemedi"}
        submitLabel={dialog?.type === "rename" ? "Kaydet" : "Ekle"}
        busyLabel={dialog?.type === "rename" ? "Kaydediliyor…" : "Ekleniyor…"}
        onAdd={async (name) => {
          if (dialog?.type === "rename") await renamePosition(dialog.position._id, name);
          else await addPosition(name);
        }}
      />
      <ConfirmDestructive
        open={dialog?.type === "delete"}
        onOpenChange={(open) => { if (!open) close(); }}
        confirmLabel="Pozisyonu sil"
        title="Pozisyon silinsin mi?"
        objectName={dialog?.type === "delete" ? dialog.position.name : ""}
        effects={["Pozisyon kalıcı silinir.", "Bu pozisyonda kişi varsa işlem engellenir; önce kişilerin pozisyonunu değiştirin."]}
        onConfirm={async () => {
          if (dialog?.type !== "delete") return;
          await deletePosition(dialog.position._id);
          if (selected === dialog.position._id) onSelect(null);
        }}
      />
    </>
  );
}
