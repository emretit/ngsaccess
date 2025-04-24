
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
    <div className="p-4 border-b space-y-1.5">
      <div 
        className="flex items-center gap-2 cursor-pointer hover:text-primary/90 transition-colors"
        onClick={onProjectClick}
      >
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-primary flex-1">{projectName}</h2>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onAddClick();
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Departmanlar</p>
    </div>
  );
}
