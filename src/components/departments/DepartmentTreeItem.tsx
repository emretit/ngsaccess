import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TREE_NAME_BUTTON, TREE_ROW_ACTIONS, TREE_TOGGLE_BUTTON } from "@/components/shared/TreePanel";
import type { Department } from "@/types/department";
import type { Id } from "../../../convex/_generated/dataModel";

interface Props {
  department: Department;
  children?: ReactNode;
  level: number;
  isSelected: boolean;
  onSelect: (id: Id<"departments">) => void;
  onAddSubDepartment: (id: Id<"departments">) => void;
  onRename?: () => void;
  /** Yalnız üst seviye departmanda: alt ağacıyla birlikte başka şirkete taşır. */
  onMoveToCompany?: () => void;
  onDelete: (id: Id<"departments">) => void;
  hasChildren: boolean;
}
export function DepartmentTreeItem({
  department,
  children,
  isSelected,
  onSelect,
  onAddSubDepartment,
  onDelete,
  onRename,
  onMoveToCompany,
  hasChildren,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <li>
      <div
        className={cn(
          "group flex min-w-0 items-center rounded-sm",
          isSelected ? "bg-selected text-primary" : "hover:bg-muted",
        )}
      >
        {/* Ok yeri her satırda ayrılır; alt departmanı olan ve olmayanların adları hizalı kalır. */}
        {hasChildren ? (
          <button
            type="button"
            className={TREE_TOGGLE_BUTTON}
            aria-label={`${department.name} alt departmanları`}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="w-5 shrink-0" />
        )}
        <button
          type="button"
          className={cn(TREE_NAME_BUTTON, isSelected && "font-medium")}
          aria-pressed={isSelected}
          onClick={() => onSelect(department._id)}
        >
          {department.name}
        </button>
        <div className={TREE_ROW_ACTIONS}>
          <RowActions label={`${department.name} işlemleri`}>
            {onRename && (
              <DropdownMenuItem onSelect={onRename}>
                Yeniden adlandır
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => onAddSubDepartment(department._id)}
            >
              Alt departman ekle
            </DropdownMenuItem>
            {onMoveToCompany && (
              <DropdownMenuItem onSelect={onMoveToCompany}>
                Şirkete taşı
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={hasChildren}
              onSelect={() => onDelete(department._id)}
            >
              Sil
            </DropdownMenuItem>
          </RowActions>
        </div>
      </div>
      {hasChildren && (
        <ul id={id} hidden={!expanded} className="ml-2.5 space-y-0.5 border-l pl-0.5">
          {children}
        </ul>
      )}
    </li>
  );
}
