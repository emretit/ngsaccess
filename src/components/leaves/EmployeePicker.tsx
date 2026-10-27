import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FieldControlProps } from "@/components/shared/FormFieldWrapper";
import { Check } from "lucide-react";
import { ComboboxTrigger, COMBOBOX_CONTENT_CLASS } from "@/components/ui/combobox-trigger";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function EmployeePicker({ projectId, value, onChange, control, disabled, allowAll = false }: {
  projectId: Id<"projects">; value: string; onChange: (value: string) => void;
  control: FieldControlProps; disabled?: boolean; allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 250);
  const data = useQuery(api.leaves.employeeOptions, { projectId, search: debounced || undefined, selectedId: value ? value as Id<"employees"> : undefined });
  const selected = data?.options.find(item => item._id === value) ?? data?.selected;
  const choose = (id: string) => { onChange(id); setOpen(false); setSearch(""); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <ComboboxTrigger {...control} placeholder={!value && !allowAll} aria-expanded={open} aria-controls={`${control.id}-options`} disabled={disabled}>
        {value ? selected?.employeeName ?? (data ? "Kişi bulunamadı" : "Kişi yükleniyor…") : allowAll ? "Tüm kişiler" : "Kişi seçin"}
      </ComboboxTrigger>
    </PopoverTrigger>
    <PopoverContent className={COMBOBOX_CONTENT_CLASS} align="start">
      <Command shouldFilter={false}>
        <CommandInput aria-label="Kişi adı veya departman ara" placeholder="Ad veya departman ara…" value={search} onValueChange={setSearch} />
        <CommandList id={`${control.id}-options`}>
          {allowAll && <CommandItem value="all" onSelect={() => choose("")}>Tüm kişiler{!value && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>}
          {data === undefined ? <p role="status" className="p-3 text-sm">Kişiler yükleniyor…</p> : <>
            {data.options.map(item => <CommandItem key={item._id} value={item._id} onSelect={() => choose(item._id)}>
              {item.employeeName} · {item.departmentName ?? "Departman belirtilmemiş"}
              {value === item._id && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}
            </CommandItem>)}
            {!data.options.length && <p role="status" className="p-3 text-sm">Eşleşen kişi yok.</p>}
            {data.truncated && <p className="p-3 text-xs text-muted-foreground">Seçenekler sınırlı; aramayı daraltın.</p>}
          </>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
