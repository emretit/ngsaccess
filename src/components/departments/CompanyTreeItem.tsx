import { useId, useState, type ReactNode } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TREE_NAME_BUTTON, TREE_ROW_ACTIONS, TREE_TOGGLE_BUTTON } from "@/components/shared/TreePanel";

/** Ağaçta şirket (şube) satırı; altında şirketin departmanları listelenir. */
export function CompanyTreeItem({ name, isSelected, hasChildren, onSelect, onAddDepartment, onEdit, onDelete, children }: {
  name: string;
  isSelected: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onAddDepartment: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <li>
      <div className={cn("group flex min-w-0 items-center rounded-sm", isSelected ? "bg-selected text-primary" : "hover:bg-muted")}>
        {hasChildren ? (
          <button type="button" className={TREE_TOGGLE_BUTTON} aria-label={`${name} departmanları`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : <span aria-hidden="true" className="w-5 shrink-0" />}
        <button type="button" className={cn(TREE_NAME_BUTTON, "flex items-center gap-1.5 font-medium")} aria-pressed={isSelected} onClick={onSelect}>
          <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{name}</span>
        </button>
        <div className={TREE_ROW_ACTIONS}>
          <RowActions label={`${name} işlemleri`}>
            <DropdownMenuItem onSelect={onAddDepartment}>Departman ekle</DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>Düzenle</DropdownMenuItem>
            <DropdownMenuItem disabled={hasChildren} onSelect={onDelete}>Sil</DropdownMenuItem>
          </RowActions>
        </div>
      </div>
      {hasChildren && <ul id={id} hidden={!expanded} className="ml-2.5 space-y-0.5 border-l pl-0.5">{children}</ul>}
    </li>
  );
}
