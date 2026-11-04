import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { ComboboxTrigger, COMBOBOX_CONTENT_CLASS } from "@/components/ui/combobox-trigger";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { AddDepartmentDialog } from "@/components/departments/AddDepartmentDialog";
import { cn } from "@/lib/utils";

interface PositionOption {
  id: string;
  name: string;
}

/** Verilirse listede ekleme, satırlarda düzenle/sil düğmeleri çıkar. */
export interface PositionActions {
  add: (name: string) => Promise<string>;
  rename: (id: string, name: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

type Dialog = { type: "add" } | { type: "rename"; position: PositionOption } | { type: "delete"; position: PositionOption };

const ROW = "flex min-h-9 items-center rounded-sm max-sm:min-h-11";
const ROW_BUTTON = "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11";
const ICON_BUTTON = "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground max-sm:h-11 max-sm:w-11";

/** Kişi formundaki pozisyon seçici: seçim + satırda düzenle/sil + listenin sonunda ekle. */
export function PositionPicker({ id, value, positions, onChange, actions, "aria-describedby": describedBy }: {
  id: string;
  value: string | null;
  positions: PositionOption[];
  onChange: (id: string | null) => void;
  actions?: PositionActions;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const renaming = dialog?.type === "rename" ? dialog.position : null;
  const deleting = dialog?.type === "delete" ? dialog.position : null;
  const onDialogOpenChange = (isOpen: boolean) => { if (!isOpen) setDialog(null); };
  const sorted = [...positions].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const selected = positions.find((position) => position.id === value);
  const choose = (next: string | null) => { onChange(next); setOpen(false); };
  const openDialog = (next: Dialog) => { setOpen(false); setDialog(next); };
  const selectedMark = <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <ComboboxTrigger id={id} className="mt-1 max-sm:min-h-11" placeholder={!selected} aria-expanded={open} aria-describedby={describedBy}>
            {selected?.name ?? "Atanmamış"}
          </ComboboxTrigger>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn(COMBOBOX_CONTENT_CLASS, "max-h-80 p-1")}>
          <ul aria-label="Pozisyonlar" className="space-y-0.5">
            <li className={ROW}>
              <button type="button" className={ROW_BUTTON} aria-pressed={!selected} onClick={() => choose(null)}>
                <span className="text-muted-foreground">Atanmamış</span>
                {!selected && selectedMark}
              </button>
            </li>
            {sorted.map((position) => (
              <li key={position.id} className={ROW}>
                <button type="button" className={ROW_BUTTON} aria-pressed={position.id === value} onClick={() => choose(position.id)}>
                  <span className="min-w-0 truncate">{position.name}</span>
                  {position.id === value && selectedMark}
                </button>
                {actions && (
                  <>
                    <Button type="button" variant="ghost" size="icon" className={ICON_BUTTON} aria-label={`${position.name} pozisyonunu düzenle`} onClick={() => openDialog({ type: "rename", position })}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className={cn(ICON_BUTTON, "hover:text-destructive")} aria-label={`${position.name} pozisyonunu sil`} onClick={() => openDialog({ type: "delete", position })}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {actions && (
            <div className="mt-1 border-t pt-1">
              <button type="button" className={cn(ROW_BUTTON, "w-full font-medium text-primary")} onClick={() => openDialog({ type: "add" })}>
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                Pozisyon ekle
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {actions && (
        <>
          <AddDepartmentDialog
            key={renaming?.id ?? "add-position"}
            isOpen={dialog?.type === "add" || renaming !== null}
            onOpenChange={onDialogOpenChange}
            title={renaming ? "Pozisyonu düzenle" : "Yeni pozisyon"}
            description={renaming ? renaming.name : "Eklenen pozisyon bu kişiye seçilir."}
            fieldLabel="Pozisyon adı"
            initialName={renaming?.name ?? ""}
            successMessage={renaming ? "Pozisyon adı güncellendi" : "Pozisyon eklendi"}
            errorMessage={renaming ? "Pozisyon adı güncellenemedi" : "Pozisyon eklenemedi"}
            submitLabel={renaming ? "Kaydet" : "Ekle"}
            busyLabel={renaming ? "Kaydediliyor…" : "Ekleniyor…"}
            onAdd={async (name) => {
              if (renaming) await actions.rename(renaming.id, name);
              else onChange(await actions.add(name));
            }}
          />
          <ConfirmDestructive
            open={deleting !== null}
            onOpenChange={onDialogOpenChange}
            confirmLabel="Pozisyonu sil"
            title="Pozisyon silinsin mi?"
            objectName={deleting?.name ?? ""}
            effects={["Pozisyon kalıcı silinir.", "Bu pozisyonda kayıtlı kişi varsa işlem engellenir; önce kişilerin pozisyonunu değiştirin."]}
            onConfirm={async () => {
              if (!deleting) return;
              await actions.remove(deleting.id);
              if (value === deleting.id) onChange(null);
            }}
          />
        </>
      )}
    </>
  );
}
