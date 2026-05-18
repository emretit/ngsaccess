import { useState } from "react";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePdksSavedViews } from "@/hooks/usePdksSavedViews";
import type { FilterValues } from "./PDKSFilterBar";

interface PDKSSavedViewsProps {
  filters: FilterValues;
  onApply: (filters: FilterValues) => void;
}

export function PDKSSavedViews({ filters, onApply }: PDKSSavedViewsProps) {
  const { views, save, remove, apply } = usePdksSavedViews();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const { toast } = useToast();

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save(trimmed, filters);
    setName("");
    setSaveOpen(false);
    toast({ title: "Görünüm kaydedildi", description: trimmed });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Görünümler</span>
            {views.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({views.length})
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs">Kayıtlı görünümler</DropdownMenuLabel>
          {views.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Henüz kayıt yok.
            </div>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onSelect={(e) => e.preventDefault()}
                className="flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  className="flex-1 text-left text-sm"
                  onClick={() => onApply(apply(v))}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  onClick={() => remove(v.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaveOpen(true)} className="gap-2">
            <BookmarkPlus className="h-4 w-4" />
            Mevcut filtreyi kaydet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Görünümü kaydet</DialogTitle>
            <DialogDescription>
              Mevcut filtre kombinasyonuna isim verin; sonra hızlıca uygulayabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Geç kalanlar — IT"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
