import { useId, useState } from "react";
import { Check } from "lucide-react";
import { ComboboxTrigger, COMBOBOX_CONTENT_CLASS } from "@/components/ui/combobox-trigger";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";

export function VisitorCombobox({ id, label, value, options, onChange, disabled, allowClear, error, "aria-describedby": describedBy }: {
  id: string; label: string; value: string | null; options: { id: string; name: string; disabled?: boolean }[];
  onChange: (value: string | null) => void; disabled?: boolean; allowClear?: boolean; error?: string; "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find(option => option.id === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <ComboboxTrigger wrap placeholder={!selected} id={id} aria-label={label} aria-controls={listId} aria-expanded={open} aria-invalid={!!error} aria-describedby={describedBy ?? (error ? `${id}-error` : undefined)} disabled={disabled}>
      {selected?.name ?? (value ? "Kayıtlı seçim" : "Seçilmedi")}
    </ComboboxTrigger>
  </PopoverTrigger><PopoverContent align="start" className={COMBOBOX_CONTENT_CLASS}><Command filter={(value, search) => value.toLocaleLowerCase("tr").includes(search.trim().toLocaleLowerCase("tr")) ? 1 : 0}>
    <CommandInput placeholder={`${label} ara…`} aria-label={`${label} ara`} /><CommandList id={listId}><CommandEmpty>Eşleşen seçenek yok.</CommandEmpty>
      {allowClear && <CommandItem value="Seçilmedi" onSelect={() => { onChange(null); setOpen(false); }}>Seçilmedi{!value && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>}
      {options.map(option => <CommandItem key={option.id} disabled={option.disabled} value={`${option.name} ${option.id}`} onSelect={() => { onChange(option.id); setOpen(false); }}>{option.name}{value === option.id && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>)}
    </CommandList>
  </Command></PopoverContent></Popover>;
}
