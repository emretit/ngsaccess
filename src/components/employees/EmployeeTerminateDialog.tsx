import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { trTodayKey } from "../../../convex/lib/trDate";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { terminationLabels, type EmploymentEmployee } from "./lib/employment";

export function EmployeeTerminateDialog({ employee, open, onOpenChange }: {
  employee: EmploymentEmployee; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const today = trTodayKey();
  const earliest = new Date(`${today}T00:00:00.000Z`);
  earliest.setUTCDate(earliest.getUTCDate() - 62);
  const latest = new Date(`${today}T00:00:00.000Z`);
  latest.setUTCDate(latest.getUTCDate() + 365);
  const terminate = useMutation(api.employeeTermination.terminate);
  const [date, setDate] = useState(trTodayKey);
  const [kind, setKind] = useState<keyof typeof terminationLabels>("resignation");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const { run, pending } = useAsyncAction(async () => {
    await terminate({ employeeId: employee._id, employmentEndDate: date, terminationType: kind,
      terminationReason: reason.trim() || undefined, sgkExitCode: code || undefined });
  }, { success: "İşten ayrılma kaydedildi" });
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent aria-busy={pending} onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onInteractOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>İşten çıkar</DialogTitle><DialogDescription>{employee.firstName} {employee.lastName} — Bu tarihten sonra kartı tüm cihazlardan silinir; PDKS'te sonraki günler devamsız sayılmaz.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async event => { event.preventDefault(); if (await run()) onOpenChange(false); }}>
        <fieldset disabled={pending} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${id}-date`}>Son çalışma günü</Label><DateInput id={`${id}-date`} min={earliest.toISOString().slice(0, 10)} max={latest.toISOString().slice(0, 10)} required disabled={pending} value={date} onChange={setDate} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-kind`}>Ayrılış türü</Label><Select value={kind} onValueChange={value => { if (value in terminationLabels) setKind(value as keyof typeof terminationLabels); }} disabled={pending}><SelectTrigger id={`${id}-kind`}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(terminationLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor={`${id}-reason`}>Neden (opsiyonel)</Label><Textarea id={`${id}-reason`} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-code`}>SGK çıkış kodu (opsiyonel)</Label><Input id={`${id}-code`} inputMode="numeric" pattern="[0-9]{2}" maxLength={2} value={code} onChange={event => setCode(event.target.value)} /></div>
        </fieldset>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Vazgeç</Button><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Kaydediliyor…" : "İşten çıkar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
