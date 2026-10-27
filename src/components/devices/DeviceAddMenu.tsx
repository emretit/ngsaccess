import { Plus, Cloud, PlusCircle, ChevronDown, ScanLine } from "lucide-react";
import { PageHeaderPrimaryButton } from "@/components/shared/PageHeader";
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
  /** Tablet/telefon kamerasıyla çalışan sanal QR okuyucu ekleme akışı. */
  onAddVirtualReader?: () => void;
}

/**
 * "Cihaz ekle" butonu — tek giriş noktası, açılan menüde üç yol:
 * yeni cihaz (lokal/sıfırdan), buluttan (havuzdan claim) veya sanal okuyucu.
 */
export function DeviceAddMenu({ onAddNew, onAddFromCloud, onAddVirtualReader }: DeviceAddMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PageHeaderPrimaryButton>
          <Plus className="h-3.5 w-3.5" />
          Cihaz ekle
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </PageHeaderPrimaryButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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
        {onAddVirtualReader && (
          <DropdownMenuItem onSelect={onAddVirtualReader} className="gap-2 py-2">
            <ScanLine className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Sanal okuyucu</span>
              <span className="text-xs text-muted-foreground">Tablet kamerasıyla mobil QR okut</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
