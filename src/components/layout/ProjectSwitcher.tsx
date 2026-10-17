import { useState } from "react";
import { ChevronsUpDown, FolderKanban, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { normalizeNavigationSearch } from "./navigationSearch";

export function ProjectSwitcher() {
  const { projects, activeProject, setActiveProjectId, loading, isSuperAdmin } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  if (loading) return <span role="status" className="block truncate py-2 text-xs text-muted-foreground">Projeler yükleniyor</span>;
  if (!projects.length) return <span role="status" className="block truncate text-xs text-muted-foreground">{isSuperAdmin ? "Henüz aktif proje yok" : "Proje ataması bekleniyor"}</span>;
  const label = <><FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate">{activeProject?.name ?? "Proje seç"}</span></>;
  if (projects.length === 1 && activeProject) return <div title={activeProject.name} className="flex min-h-9 min-w-0 items-center gap-2 text-sm font-medium">{label}</div>;
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setSearch(""); }}>
    <PopoverTrigger asChild><button id="project-switcher" type="button" aria-label={`Proje seç: ${activeProject?.name ?? "Seçim yapın"}`} className="flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md text-left text-sm font-medium hover:bg-subtle">{label}<ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /></button></PopoverTrigger>
    <PopoverContent align="start" collisionPadding={16} className="w-[320px] max-w-[calc(100vw-32px)] p-0">
      <div className="p-3"><p className="font-semibold">Proje seç</p><p className="mt-1 text-xs text-muted-foreground">{isSuperAdmin ? "Tüm aktif projeler" : "Atandığınız projeler"}</p></div>
      <Command shouldFilter={false}>
        <label htmlFor="project-search" className="px-3 text-xs font-medium">Proje ara</label>
        <CommandInput aria-label="Proje ara" id="project-search" placeholder="Proje adı yazın…" value={search} onValueChange={setSearch} />
        <CommandList className="p-1"><CommandEmpty>Bu adla eşleşen proje yok</CommandEmpty>
          {projects.filter(project => normalizeNavigationSearch(project.name).includes(normalizeNavigationSearch(search))).map(project => <CommandItem key={project._id} value={project._id} onSelect={() => { setActiveProjectId(project._id); setOpen(false); }} className="gap-2 py-3">
            <span className="min-w-0 flex-1 whitespace-normal break-words">{project.name}</span>{project._id === activeProject?._id && <><Check className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili proje</span></>}
          </CommandItem>)}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
