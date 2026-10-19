import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { filterNavigationRoutes } from "./navigationSearch";

export function CommandPalette() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const changeOpen = (next: boolean) => {
    if (next) { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setQuery(""); }
    setOpen(next);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // Do not create a second modal over a form, project menu or mobile menu.
        if (document.querySelector('[role="dialog"]') && !open) return;
        event.preventDefault();
        if (!open) { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setQuery(""); }
        setOpen(value => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" aria-label="Sayfa ara (⌘K / Ctrl+K)" className="h-11 w-11 shrink-0 border-line bg-canvas p-0 text-muted-foreground min-[1000px]:w-[240px] min-[1000px]:justify-start min-[1000px]:px-3">
      <Search aria-hidden="true" /><span className="hidden min-[1000px]:inline">Sayfa ara…</span><kbd className="ml-auto hidden rounded border px-1 text-[11px] min-[1000px]:inline">⌘K</kbd>
    </Button></DialogTrigger>
    <DialogContent className="overflow-hidden p-0" onCloseAutoFocus={event => {
      if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); }
    }}>
      <div className="px-4 pt-4"><DialogTitle>Sayfaya git</DialogTitle><DialogDescription className="sr-only">İzin verilen sayfalarda ara. Ok tuşlarıyla seçin ve Enter ile açın.</DialogDescription></div>
      <Command shouldFilter={false}>
        <CommandInput aria-label="Sayfa adı" placeholder="Sayfa adı yazın…" value={query} onValueChange={setQuery} />
        <CommandList><CommandEmpty>Sonuç bulunamadı. Başka bir sayfa adı deneyin.</CommandEmpty><CommandGroup>
          {filterNavigationRoutes(profile?.role, query).map(route => <CommandItem key={route.href} value={route.href} onSelect={() => { setOpen(false); navigate(route.href); }} className="gap-3 py-3"><route.icon className="h-4 w-4" aria-hidden="true" />{route.name}</CommandItem>)}
        </CommandGroup></CommandList>
      </Command>
    </DialogContent>
  </Dialog>;
}
