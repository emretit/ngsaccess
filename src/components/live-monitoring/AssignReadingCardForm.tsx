import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { errorMessage, notify } from "@/lib/notify";
import type { Reading } from "./lib/readings";
import { assignmentValidation, assignmentSuccess, type Assignment } from "./lib/assignment";
export function AssignReadingCardForm({ reading, onDirty, onPending }: { reading: Reading; onDirty: (dirty: boolean) => void; onPending: (pending: boolean) => void }) {
  const people = useQuery(api.employees.list, reading.projectId ? { projectId: reading.projectId } : "skip");
  const assign = useMutation(api.cardReadings.assignCardFromReading);
  const [values, setValues] = useState<Assignment>({ employeeId: "", expectedCurrentCard: null, replace: false });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const personTrigger = useRef<HTMLButtonElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const selected = people?.find(p => p._id === values.employeeId);
  const changed = Boolean(selected && selected.cardNumber !== values.expectedCurrentCard);
  const replacing = Boolean(values.expectedCurrentCard && values.expectedCurrentCard !== reading.cardNo);
  useEffect(() => { onDirty(Boolean(values.employeeId) && !success); }, [values.employeeId, success, onDirty]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    const validation = assignmentValidation(values, selected, reading.cardNo);
    if (validation || !selected) { setError(validation || "Bir kişi seçin"); if (!selected) personTrigger.current?.focus(); else confirmInput.current?.focus(); return; }
    lock.current = true; setPending(true); onPending(true); setError("");
    try {
      const result = await assign({ readingId: reading._id, employeeId: selected._id, expectedCurrentCard: values.expectedCurrentCard });
      const message = assignmentSuccess(result);
      setSuccess(message); onDirty(false); notify.success(message);
    } catch (err: unknown) { setError(errorMessage(err)); }
    finally { lock.current = false; setPending(false); onPending(false); }
  };
  return <form onSubmit={event => void submit(event)} className="min-w-0 space-y-4 border-t border-line pt-4">
    <h3 className="font-semibold">Kartı kişiye ata</h3>
    <p className="break-all text-xs">Kart numarası: <span className="tabular-nums">{reading.cardNo}</span></p>
    <div className="space-y-1"><label id="assign-person-label" className="text-xs">Kişi</label><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button ref={personTrigger} variant="outline" role="combobox" aria-expanded={open} aria-labelledby="assign-person-label" aria-describedby="assignment-error" disabled={pending || Boolean(success)} className="w-full justify-start truncate">{selected ? `${selected.firstName} ${selected.lastName}` : "Bir kişi seçin"}</Button></PopoverTrigger><PopoverContent className="w-[min(360px,calc(100vw-48px))] p-0"><Command><CommandInput placeholder="Projede kişi ara…" aria-label="Projede kişi ara" /><CommandList><CommandEmpty>Kişi bulunamadı</CommandEmpty>{people?.map(person => <CommandItem key={person._id} disabled={person.isActive === false} value={`${person.firstName} ${person.lastName} ${person._id}`} onSelect={() => { setValues({ employeeId: person._id, expectedCurrentCard: person.cardNumber, replace: false }); setOpen(false); setError(""); }}>{person.firstName} {person.lastName}{person.isActive === false ? " · Pasif" : ""}</CommandItem>)}</CommandList></Command></PopoverContent></Popover></div>
    {selected && <p className="break-all text-xs">Mevcut kart: {values.expectedCurrentCard || "Yok"}</p>}
    {changed && !success && <div role="alert" className="space-y-2 text-xs"><p>Kişinin kartı değişti. Güncel kart: {selected?.cardNumber || "Yok"}</p><Button type="button" variant="outline" onClick={() => { if (selected) { setValues(v => ({ ...v, expectedCurrentCard: selected.cardNumber, replace: false })); setError(""); } }}>Güncel kartı kullan</Button></div>}
    {replacing && <label className="flex items-start gap-2 text-xs"><input ref={confirmInput} type="checkbox" checked={values.replace} disabled={pending || Boolean(success)} onChange={e => setValues(v => ({ ...v, replace: e.target.checked }))} aria-describedby="assignment-error" className="mt-0.5 h-4 w-4" />Mevcut kart değiştirilecek. Mevcut kartı değiştireceğimi onaylıyorum.</label>}
    <p className="text-xs text-muted-foreground">Atama kişinin kartını günceller ve cihaz senkronunu planlar. Cihazda uygulandığı ayrıca doğrulanır. Geçmiş okumanın kişi bilgisi değişmez.</p>
    {error && <p id="assignment-error" role="alert" className="text-xs text-danger">{error}</p>}
    {success ? <p role="status" className="text-xs">{success}</p> : <Button type="submit" disabled={pending || !people || changed}>{pending ? "Atanıyor…" : "Atamayı onayla"}</Button>}
  </form>;
}
