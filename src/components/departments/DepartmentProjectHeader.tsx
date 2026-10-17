import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
export function DepartmentProjectHeader({
  projectName,
  onProjectClick,
  onAddClick,
}: {
  projectName: string;
  onProjectClick: () => void;
  onAddClick: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center border-b py-2">
      <button
        className="min-h-11 min-w-0 flex-1 truncate text-left text-sm font-semibold"
        onClick={onProjectClick}
      >
        {projectName}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label="Departman ekle"
        onClick={onAddClick}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
