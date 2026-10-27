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
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";
import { usePdksSavedViews } from "@/hooks/usePdksSavedViews";
import type { FilterValues } from "./PDKSFilterBar";

interface PDKSSavedViewsProps {
  filters: FilterValues;
  onApply: (filters: FilterValues) => void;
}

export function PDKSSavedViews({ filters, onApply }: PDKSSavedViewsProps) {
  const { views, save, remove, apply } = usePdksSavedViews();
  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save(trimmed, filters);
    setName("");
    setSaveOpen(false);
    notify.success("Görünüm kaydedildi", trimmed);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Kayıtlı görünümler" variant="outline" size="sm" className="gap-1.5">
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
              <div key={v.id}>
                <DropdownMenuItem aria-label={v.name} onSelect={() => onApply(apply(v))}><span className="min-w-0 truncate" title={v.name}>{v.name}</span></DropdownMenuItem>
                <DropdownMenuItem aria-label={`${v.name} görünümünü sil`} onSelect={() => setDeleteId(v.id)} className="gap-2 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Sil
                </DropdownMenuItem>
              </div>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaveOpen(true)} className="gap-2">
            <BookmarkPlus className="h-4 w-4" />
            Mevcut filtreyi kaydet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDestructive
        open={deleteId !== null}
        onOpenChange={open => { if (!open) setDeleteId(null); }}
        title="Görünüm silinsin mi?"
        objectName={views.find(view => view.id === deleteId)?.name ?? "Kayıtlı görünüm"}
        effects={["Kaydedilen filtre seçimi silinir."]}
        confirmLabel="Sil"
        onConfirm={async () => { if (deleteId) await remove(deleteId); }}
      />
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
            maxLength={60}
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
