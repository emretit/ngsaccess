import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
export type MonitoringPerson = FunctionReturnType<typeof api.cardReadings.searchMonitoringPeople>[number];
export function MonitoringPersonPicker({ projectId, value, onChange, disabled, allowClear = false, buttonRef }: {
  projectId: Id<"projects">; value: string; onChange: (person: MonitoringPerson | null) => void;
  disabled?: boolean; allowClear?: boolean; buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const { can } = usePermissions();
  const people = useQuery(api.cardReadings.searchMonitoringPeople, can("reports.view") || can("devices.manage") ? { projectId, search: term, selectedId: value || undefined } : "skip");
  const selected = people?.find(person => person._id === value);
  useEffect(() => {
    if (allowClear && value && people !== undefined && !selected) onChange(null);
  }, [allowClear, value, people, selected, onChange]);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button ref={buttonRef} type="button" variant="outline" role="combobox" aria-label="Kişi" aria-expanded={open} disabled={disabled} className="w-full justify-start truncate">{selected ? `${selected.firstName} ${selected.lastName}` : allowClear ? "Tüm kişiler" : "Bir kişi seçin"}</Button></PopoverTrigger><PopoverContent className="w-[min(360px,calc(100vw-48px))] p-0"><Command shouldFilter={false}><CommandInput value={search} onValueChange={setSearch} placeholder="Ad veya soyad ara…" aria-label="Projede kişi ara" /><CommandList><CommandEmpty>{people === undefined || term !== search ? "Aranıyor…" : "Kişi bulunamadı"}</CommandEmpty>
    {allowClear && <CommandItem onSelect={() => { onChange(null); setOpen(false); }}>Tüm kişiler</CommandItem>}
    {term === search && people?.map(person => <CommandItem key={person._id} disabled={!allowClear && person.isActive === false} value={person._id} onSelect={() => { onChange(person); setOpen(false); }}>{person.firstName} {person.lastName}{person.isActive === false ? " · Pasif" : ""}</CommandItem>)}
  </CommandList></Command><p className="px-3 py-2 text-xs text-muted-foreground">En fazla 40 kişi gösterilir. Sonucu daraltmak için ad veya soyad yazın.</p></PopoverContent></Popover>;
}
