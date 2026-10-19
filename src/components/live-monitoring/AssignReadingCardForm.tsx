import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MonitoringPersonPicker } from "./MonitoringPersonPicker";

import { errorMessage, notify } from "@/lib/notify";
import type { Reading } from "./lib/readings";
import { assignmentValidation, assignmentSuccess, type Assignment } from "./lib/assignment";
export function AssignReadingCardForm({ reading, onDirty, onPending }: { reading: Reading; onDirty: (dirty: boolean) => void; onPending: (pending: boolean) => void }) {
  const assign = useMutation(api.cardReadings.assignCardFromReading);
  const [values, setValues] = useState<Assignment>({ employeeId: "", expectedCurrentCard: null, replace: false });
  const people = useQuery(api.cardReadings.searchMonitoringPeople, reading.projectId ? { projectId: reading.projectId, search: "", selectedId: values.employeeId || undefined } : "skip");
  const selected = people?.find(person => person._id === values.employeeId);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const personTrigger = useRef<HTMLButtonElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const changed = Boolean(selected && selected.cardNumber !== values.expectedCurrentCard);
  const replacing = Boolean(values.expectedCurrentCard && values.expectedCurrentCard !== reading.cardNo);
  useEffect(() => { onDirty(Boolean(values.employeeId) && !success); }, [values.employeeId, success, onDirty]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    const validation = assignmentValidation(values, selected ?? undefined, reading.cardNo);
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
    {reading.projectId && <div className="space-y-1"><span className="text-xs">Kişi</span><MonitoringPersonPicker projectId={reading.projectId} value={values.employeeId} buttonRef={personTrigger} disabled={pending || Boolean(success)} onChange={person => { setValues({ employeeId: person?._id ?? "", expectedCurrentCard: person?.cardNumber ?? null, replace: false }); setError(""); }} /></div>}
    {selected && <p className="break-all text-xs">Mevcut kart: {values.expectedCurrentCard || "Yok"}</p>}
    {changed && !success && <div role="alert" className="space-y-2 text-xs"><p>Kişinin kartı değişti. Güncel kart: {selected?.cardNumber || "Yok"}</p><Button type="button" variant="outline" onClick={() => { if (selected) { setValues(v => ({ ...v, expectedCurrentCard: selected.cardNumber, replace: false })); setError(""); } }}>Güncel kartı kullan</Button></div>}
    {replacing && <label className="flex items-start gap-2 text-xs"><input ref={confirmInput} type="checkbox" checked={values.replace} disabled={pending || Boolean(success)} onChange={e => setValues(v => ({ ...v, replace: e.target.checked }))} aria-describedby="assignment-error" className="mt-0.5 h-4 w-4" />Mevcut kart değiştirilecek. Mevcut kartı değiştireceğimi onaylıyorum.</label>}
    <p className="text-xs text-muted-foreground">Atama kişinin kartını günceller ve cihaz senkronunu planlar. Cihazda uygulandığı ayrıca doğrulanır. Geçmiş okumanın kişi bilgisi değişmez.</p>
    {error && <p id="assignment-error" role="alert" className="text-xs text-danger">{error}</p>}
    {success ? <p role="status" className="text-xs">{success}</p> : <Button type="submit" disabled={pending || !selected || changed}>{pending ? "Atanıyor…" : "Atamayı onayla"}</Button>}
  </form>;
}
