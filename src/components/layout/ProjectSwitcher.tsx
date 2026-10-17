import { ChevronsUpDown, FolderKanban, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { roleLabel as formatRole } from "@/lib/roleLabels";

export function ProjectSwitcher() {
  const { profile } = useAuth();
  const { projects, activeProject, setActiveProjectId, loading } = useActiveProject();

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground">
        <FolderKanban className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Yükleniyor…</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return <span className="text-xs text-muted-foreground" role="status">Proje ataması bekleniyor</span>;
  }

  const role = profile?.role;
  const roleLabel = role ? formatRole(role) : "";
  const multi = projects.length > 1;

  const baseClass = cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground",
    "min-h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  );

  const labelContent = (
    <>
      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium leading-tight">
          {activeProject?.name ?? "Proje seç"}
        </span>
        {roleLabel && (
          <span className="truncate text-[10px] text-muted-foreground leading-tight">
            {roleLabel}
          </span>
        )}
      </div>
      {multi && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </>
  );

  if (!multi) {
    return <div className={baseClass}>{labelContent}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Proje seç: ${activeProject?.name ?? "Seçim yapın"}`} className={cn(baseClass, "hover:bg-muted")}>
          {labelContent}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Proje Seç
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.map((p) => {
          const isActive = p._id === activeProject?._id;
          return (
            <DropdownMenuItem
              key={p._id}
              onSelect={() => setActiveProjectId(p._id)}
              className="cursor-pointer"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
