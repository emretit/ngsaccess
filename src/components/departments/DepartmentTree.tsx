import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useState } from "react";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import type { Id } from "../../../convex/_generated/dataModel";

import { Plus, Users, UserX } from "lucide-react";
import { DepartmentTreeItem } from "./DepartmentTreeItem";
import { CompanyTreeItem } from "./CompanyTreeItem";
import { AddDepartmentDialog } from "./AddDepartmentDialog";
import { CompanyDialog } from "./CompanyDialog";
import { MoveDepartmentDialog } from "./MoveDepartmentDialog";
import {
  TREE_ICON_BUTTON,
  TreePanel,
  TreePanelHeader,
  treeFixedItemClass,
} from "@/components/shared/TreePanel";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDepartments } from "@/hooks/useDepartments";
import { useCompanies, type Company } from "@/hooks/useOrgUnits";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Department } from "@/types/department";

interface DepartmentTreeProps {
  /** Seçili departman ya da "unassigned". */
  selectedValue?: string;
  selectedCompany?: string;
  onSelectUnassigned?: () => void;
  onSelectDepartment: (id: Id<"departments"> | null) => void;
  onSelectCompany?: (id: Id<"companies">) => void;
}

/** Kişiler sol paneli: Şirket → Departman ağacı. Pozisyonlar kişi formundaki listeden eklenir. */
export default function DepartmentTree(props: DepartmentTreeProps) {
  const { projectId } = useActiveProject();
  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col gap-3 min-[1100px]:w-[220px]">
      <OrgTree key={`org-${projectId ?? "none"}`} {...props} />
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
                <DropdownMenuItem disabled={companies.length === 0} onSelect={() => setDialog({ type: "addDepartment", parent: null, company: null })}>
                  {companies.length ? "Departman ekle" : "Departman ekle (önce şirket ekleyin)"}
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
            {looseDepartments.length > 0 && companies.length > 0 && (
              <li role="presentation" className="px-2 pb-0.5 pt-2 text-[11px] font-medium text-muted-foreground">
                Şirkete bağlanmamış · menüden "Şirkete taşı"
              </li>
            )}
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
        // Alt departman üstünün şirketini alır; üst seviyede şirket seçimi zorunlu.
        companies={addingDepartment?.parent ? undefined : companies}
        initialCompanyId={addingDepartment?.company?._id}
        onAdd={(name, companyId) => addDepartment(
          name,
          addingDepartment?.parent?._id ?? null,
          companies.find((company) => company._id === companyId)?._id ?? null,
        )}
        title="Yeni Departman Ekle"
        description={
          addingDepartment?.parent
            ? `${addingDepartment.parent.name} altına eklenecek departmanın adını girin`
            : "Departmanın bağlı olacağı şirketi seçip adını girin"
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
