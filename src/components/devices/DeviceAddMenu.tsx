import { Plus, Cloud, PlusCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface DeviceAddMenuProps {
  /** Sıfırdan cihaz oluşturma akışı (marka seçici → form). */
  onAddNew: () => void;
  /** Havuzdan (buluttan) atanmamış cihazı projeye ekleme akışı. */
  onAddFromCloud: () => void;
}

/**
 * "Cihaz ekle" butonu — tek giriş noktası, açılan menüde iki yol:
 * yeni cihaz (lokal/sıfırdan) veya buluttan (havuzdan claim).
 */
export function DeviceAddMenu({ onAddNew, onAddFromCloud }: DeviceAddMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="min-h-11 md:min-h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Cihaz ekle
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onAddNew} className="gap-2 py-2">
          <PlusCircle className="h-4 w-4 shrink-0 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Yeni cihaz</span>
            <span className="text-xs text-muted-foreground">Sıfırdan kur — marka seç</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddFromCloud} className="gap-2 py-2">
          <Cloud className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Havuzdan ata</span>
            <span className="text-xs text-muted-foreground">Havuzdan projeye ata</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
