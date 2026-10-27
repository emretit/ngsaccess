import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FieldControlProps } from "@/components/shared/FormFieldWrapper";
import { Button } from "@/components/ui/button";
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
      <Button {...control} type="button" variant="outline" role="combobox" aria-expanded={open} aria-controls={`${control.id}-options`} disabled={disabled} className="w-full min-w-0 justify-between">
        <span className="truncate">{value ? selected?.employeeName ?? (data ? "Kişi bulunamadı" : "Kişi yükleniyor…") : allowAll ? "Tüm kişiler" : "Kişi seçin"}</span><span aria-hidden>⌄</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[min(340px,calc(100vw-32px))] p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput aria-label="Kişi adı veya departman ara" placeholder="Ad veya departman ara…" value={search} onValueChange={setSearch} />
        <CommandList id={`${control.id}-options`}>
          {allowAll && <CommandItem value="all" onSelect={() => choose("")}>Tüm kişiler</CommandItem>}
          {data === undefined ? <p role="status" className="p-3 text-sm">Kişiler yükleniyor…</p> : <>
            {data.options.map(item => <CommandItem key={item._id} value={item._id} onSelect={() => choose(item._id)} aria-selected={value === item._id}>
              {item.employeeName} · {item.departmentName ?? "Departman belirtilmemiş"}
            </CommandItem>)}
            {!data.options.length && <p role="status" className="p-3 text-sm">Eşleşen kişi yok.</p>}
            {data.truncated && <p className="p-3 text-xs text-muted-foreground">Seçenekler sınırlı; aramayı daraltın.</p>}
          </>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
