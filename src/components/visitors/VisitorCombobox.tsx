import { useId, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";

export function VisitorCombobox({ id, label, value, options, onChange, disabled, allowClear, error, "aria-describedby": describedBy }: {
  id: string; label: string; value: string | null; options: { id: string; name: string }[];
  onChange: (value: string | null) => void; disabled?: boolean; allowClear?: boolean; error?: string; "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <Button type="button" id={id} role="combobox" aria-label={label} aria-controls={listId} aria-expanded={open} aria-invalid={!!error} aria-describedby={describedBy ?? (error ? `${id}-error` : undefined)} disabled={disabled} variant="outline" className="h-auto min-h-9 w-full justify-between whitespace-normal text-left font-normal">
      <span className="min-w-0 break-words">{options.find(option => option.id === value)?.name ?? (value ? "Kayıtlı seçim" : "Seçilmedi")}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
    </Button>
  </PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-32px)] p-0"><Command filter={(value, search) => value.toLocaleLowerCase("tr").includes(search.trim().toLocaleLowerCase("tr")) ? 1 : 0}>
    <CommandInput placeholder={`${label} ara…`} aria-label={`${label} ara`} /><CommandList id={listId}><CommandEmpty>Eşleşen seçenek yok.</CommandEmpty>
      {allowClear && <CommandItem value="Seçilmedi" onSelect={() => { onChange(null); setOpen(false); }}>Seçilmedi</CommandItem>}
      {options.map(option => <CommandItem key={option.id} value={`${option.name} ${option.id}`} onSelect={() => { onChange(option.id); setOpen(false); }}>{option.name}</CommandItem>)}
    </CommandList>
  </Command></PopoverContent></Popover>;
}
