
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepartmentProjectHeaderProps {
  projectName: string;
  onProjectClick: () => void;
  onAddClick: () => void;
}

export function DepartmentProjectHeader({ 
  projectName, 
  onProjectClick, 
  onAddClick 
}: DepartmentProjectHeaderProps) {
  return (
    <div className="p-4 border-b border-gray-100">
      <div
        className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors"
        onClick={onProjectClick}
      >
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-primary flex-1">{projectName}</h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onAddClick();
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Departmanlar</p>
    </div>
  );
}
