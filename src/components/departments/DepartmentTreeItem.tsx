import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
  hasChildren,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <li>
      <div
        className={`flex min-w-0 items-center rounded-md ${isSelected ? "bg-selected text-primary" : "hover:bg-muted"}`}
      >
        {hasChildren && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={`${department.name} alt departmanları`}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight
              className={`h-4 w-4 ${expanded ? "rotate-90" : ""}`}
            />
          </Button>
        )}
        <button
          className="min-h-11 min-w-0 flex-1 truncate px-2 text-left text-sm"
          aria-pressed={isSelected}
          onClick={() => onSelect(department._id)}
        >
          {department.name}
        </button>
        <div className="shrink-0 [&_button]:h-11 [&_button]:w-11">
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
        <ul id={id} hidden={!expanded} className="ml-2 border-l pl-1">
          {children}
        </ul>
      )}
    </li>
  );
}
