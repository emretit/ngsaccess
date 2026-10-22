import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { getTurkishHolidaysForYear } from "../../../../../convex/lib/turkishHolidays";
import { todayInTurkey } from "@/lib/date";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { DraftNotice, useSettingsFormState } from "../../SettingsFormState";
import { DateInput } from "@/components/ui/date-picker";

export const holidaySchema = z.object({
  date: z.iso.date("Geçerli bir tarih seçin"),
  name: z.string().trim().min(1, "Tatil adı zorunlu").max(100, "Tatil adı en fazla 100 karakter"),
  isHalfDay: z.boolean(),
});
type HolidayValues = z.infer<typeof holidaySchema>;
const empty: HolidayValues = { date: "", name: "", isHalfDay: false };

export function countMissingHolidays(year: number, existing: readonly { date: string }[]): number {
  const dates = new Set(existing.map(row => row.date));
  return getTurkishHolidaysForYear(year).filter(row => !dates.has(row.date)).length;
}

function HolidayCalendarContent() {
  const { projectId, loading } = useActiveProjectScope();
  const isAdmin = usePermissions().can("schedule.manage");
  const [year, setYear] = useState(Number(todayInTurkey().slice(0, 4)));
  const [yearText, setYearText] = useState(String(year));
  useEffect(() => { setYearText(String(year)); }, [year]);
  const [values, setValues] = useState(empty);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof HolidayValues, string>>>({});
  const [failed, setFailed] = useState(false);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteHoliday, setDeleteHoliday] = useState<FunctionReturnType<typeof api.holidays.list>[number] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const dirty = open && (values.date !== "" || values.name !== "" || values.isHalfDay);
  const guard = useUnsavedChangesGuard(dirty);
  const holidays = useQuery(api.holidays.list, !loading && projectId && isAdmin ? { projectId, year } : "skip");
  const create = useMutation(api.holidays.create);
  const remove = useMutation(api.holidays.remove);
  const seed = useMutation(api.holidays.seedTurkishHolidays);
  const add = useAsyncAction(async (payload: HolidayValues) => {
    if (!projectId) throw new Error("Önce bir proje seçin.");
    await create({ projectId, ...payload });
    setYear(Number(payload.date.slice(0, 4))); setFocusDate(payload.date); setValues(empty); setOpen(false);
  }, { success: "Tatil eklendi", error: "Tatil eklenemedi" });
  const seedAction = useAsyncAction(async () => {
    if (!projectId) throw new Error("Önce bir proje seçin.");
    const result = await seed({ projectId, years: [year] });
    const missing = result.missingReligiousYears ?? [];
    notify.success(`${year} resmi tatilleri yüklendi`, `${result.inserted} yeni eklendi, ${result.skipped} mevcut.${missing.length ? ` ${missing.join(", ")} için dini tatilleri ayrıca ekleyin.` : ""}`);
  }, { error: "Tatiller yüklenemedi" });
  const seedCount = countMissingHolidays(year, holidays ?? []);
  const pending = add.pending || seedAction.pending || deleting;
  useSettingsFormState("holidays", dirty, pending);
  useEffect(() => {
    if (focusDate && holidays?.some(holiday => holiday.date === focusDate)) {
      document.getElementById(`holiday-${focusDate}`)?.focus(); setFocusDate(null);
    }
  }, [holidays, focusDate]);
  const close = () => { if (!pending) guard.requestClose(() => { setOpen(false); setValues(empty); setErrors({}); setFailed(false); }); };
  return <section className="min-w-0 space-y-4 border-t pt-6">
    <h3 className="text-base font-semibold">Tatil takvimi</h3>
    <div className="flex flex-wrap items-end gap-3">
      <FormFieldWrapper htmlFor="holiday-year" label="Yıl">
        <Input type="number" min={1900} max={2100} value={yearText} disabled={pending} className="w-24" onChange={event => {
          const text = event.target.value; setYearText(text);
          const next = Number(text); if (/^\d{4}$/.test(text) && next >= 1900 && next <= 2100) setYear(next);
        }} onBlur={() => setYearText(String(year))} />
      </FormFieldWrapper>
      <Button variant="outline" disabled={pending || !projectId || holidays === undefined} onClick={() => setSeedOpen(true)}>{seedAction.pending ? "Yükleniyor…" : "Resmi tatilleri yükle"}</Button>
      <Button variant="outline" disabled={pending || !projectId} onClick={() => setOpen(true)}>Tatil ekle</Button>
    </div>
    {loading || holidays === undefined ? <SectionSkeleton label="Tatiller yükleniyor" /> : holidays.length === 0 ?
      <EmptyState title={`${year} yılı için tanımlı tatil yok`} description="Bir tatil ekleyin veya resmi tatilleri yükleyin." /> :
      <div className="min-w-0 overflow-x-auto rounded-md border"><Table density="compact">
        <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Tatil adı</TableHead><TableHead><span className="sr-only">İşlemler</span></TableHead></TableRow></TableHeader>
        <TableBody>{[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map(holiday => <TableRow key={holiday._id} id={`holiday-${holiday.date}`} tabIndex={-1} className="h-[42px]">
          <TableCell className="tabular-nums whitespace-nowrap">{new Date(`${holiday.date}T12:00:00`).toLocaleDateString("tr-TR")}<span className="block text-xs text-muted-foreground">{new Date(`${holiday.date}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "long" })}</span></TableCell>
          <TableCell className="break-words whitespace-normal">{holiday.name}<span className="block text-xs text-muted-foreground">{holiday.isHalfDay ? "Yarım gün" : "Tam gün"}</span></TableCell>
          <TableCell className="w-12"><Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`${holiday.name} tatilini sil`} disabled={pending} onClick={() => { setDeleteHoliday(holiday); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent onCloseAutoFocus={event => { if (focusDate) { event.preventDefault(); document.getElementById(`holiday-${focusDate}`)?.focus(); } }}>
        <DialogHeader><DialogTitle>Tatil ekle</DialogTitle><DialogDescription>Tatil seçili projenin takvimine eklenir. Yıldızlı alanlar zorunludur.</DialogDescription></DialogHeader>
        <form className="space-y-4" noValidate onSubmit={async event => {
          event.preventDefault(); const parsed = holidaySchema.safeParse(values);
          if (!parsed.success) {
            const next: Partial<Record<keyof HolidayValues, string>> = {};
            for (const issue of parsed.error.issues) next[issue.path[0] as keyof HolidayValues] = issue.message;
            setErrors(next); document.getElementById(`holiday-${String(parsed.error.issues[0]?.path[0])}`)?.focus(); return;
          }
          setErrors({}); setFailed(!await add.run(parsed.data));
        }}>
          <DraftNotice failed={failed} />
          <fieldset disabled={pending} className="space-y-4">
            <FormFieldWrapper htmlFor="holiday-date" label="Tarih *" error={errors.date}><DateInput required value={values.date} onChange={date => setValues({ ...values, date })} /></FormFieldWrapper>
            <FormFieldWrapper htmlFor="holiday-name" label="Tatil adı *" error={errors.name}><Input required maxLength={100} value={values.name} onChange={event => setValues({ ...values, name: event.target.value })} /></FormFieldWrapper>
            <FormFieldWrapper inline htmlFor="holiday-half" label="Yarım gün"><Checkbox checked={values.isHalfDay} onCheckedChange={checked => setValues({ ...values, isHalfDay: checked === true })} /></FormFieldWrapper>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={pending} onClick={close}>Vazgeç</Button><Button type="submit" disabled={pending}>{add.pending ? "Ekleniyor…" : "Tatili ekle"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <HolidaySeedConfirmation open={seedOpen} year={year} count={seedCount} pending={seedAction.pending} onOpenChange={setSeedOpen} onConfirm={async () => { if (await seedAction.run()) setSeedOpen(false); }} />
    {guard.dialog}
    <ConfirmDestructive open={deleteOpen} onOpenChange={setDeleteOpen} title="Tatil silinsin mi?" objectName={deleteHoliday?.name ?? "Tatil"}
      effects={[`${deleteHoliday?.date ?? "Seçili gün"} için tatil tanımı kaldırılır.`]} confirmLabel="Tatili sil" onConfirm={async () => {
        if (!deleteHoliday) throw new Error("Tatil seçilmedi");
        setDeleting(true);
        try { await remove({ id: deleteHoliday._id }); notify.success("Tatil silindi"); } finally { setDeleting(false); }
      }} />
  </section>;
}
export function HolidayCalendarManager() {
  const { projectId } = useActiveProjectScope();
  return <QuerySectionBoundary resetKey={projectId} title="Tatil takvimi yüklenemedi"><HolidayCalendarContent /></QuerySectionBoundary>;
}

export function HolidaySeedConfirmation({ open, year, count, pending, onOpenChange, onConfirm }: {
  open: boolean; year: number; count: number; pending: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void;
}) {
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent><DialogHeader><DialogTitle>Resmi tatiller yüklensin mi?</DialogTitle><DialogDescription>{year} yılı için {count} tatil eklenecek. Mevcut tarihler korunur.</DialogDescription></DialogHeader>
      <div className="flex justify-end gap-3"><Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={pending || count === 0} onClick={onConfirm}>Tatilleri yükle</Button></div>
    </DialogContent>
  </Dialog>;
}
