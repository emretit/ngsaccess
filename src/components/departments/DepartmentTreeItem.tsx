import { useState } from "react";
import { ChevronRight, Grid, Plus, Trash2, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Department } from "@/types/department";

interface DepartmentTreeItemProps {
  department: Department;
  children?: React.ReactNode;
  level: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onAddSubDepartment: (parentId: number) => void;
  onDelete: (id: number) => void;
  hasChildren: boolean;
}

export function DepartmentTreeItem({
  department,
  children,
  level,
  isSelected,
  onSelect,
  onAddSubDepartment,
  onDelete,
  hasChildren,
}: DepartmentTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showClickIcon, setShowClickIcon] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Enter":
        onSelect(department.id);
        break;
      case "ArrowRight":
        setIsExpanded(true);
        break;
      case "ArrowLeft":
        setIsExpanded(false);
        break;
    }
  };

  return (
    <li role="treeitem" aria-expanded={isExpanded}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md p-2 transition-all relative",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent/80 text-accent-foreground font-medium",
          level === 0 ? "mt-0" : "mt-0.5"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(department.id)}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setShowClickIcon(true)}
        onMouseLeave={() => setShowClickIcon(false)}
        tabIndex={0}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </Button>

        <Grid className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{department.name}</span>
        
        {showClickIcon && (
          <MousePointerClick className="h-3 w-3 text-muted-foreground/70 absolute right-20" />
        )}

        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/80"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubDepartment(department.id);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/80"
            disabled={hasChildren}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(department.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {children && (
        <ul
          role="group"
          className={cn(
            "overflow-hidden transition-all duration-200",
            isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          {children}
        </ul>
      )}
    </li>
  );
}
