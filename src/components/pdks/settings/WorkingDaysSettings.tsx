import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { WEEKDAY_NAMES } from "../../../../convex/lib/workingDays";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { SettingsSaveBar } from "@/components/settings/SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "@/components/settings/SettingsFormState";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** PDKS hafta sonu tanımı: seçilmeyen günler hafta tatili sayılır. */
export function WorkingDaysSettings({ projectId }: { projectId: Id<"projects"> }) {
  const stored = useQuery(api.settings.getWorkingDays, { projectId });
  const save = useMutation(api.settings.saveWorkingDays);
  const [failed, setFailed] = useState(false);
  const draft = useSettingsDraft<{ days: string[] }>({ days: stored ?? [] });
  const days = draft.values.days;
  const { run, pending } = useAsyncAction(async () => {
    await save({ projectId, workingDays: days });
    draft.reset();
  }, { success: "Çalışma günleri kaydedildi" });
  useSettingsFormState("workingDays", draft.dirty, pending);
  if (stored === undefined) return <SectionSkeleton label="Çalışma günleri yükleniyor" />;
  if (stored === null) return null;
  const toggle = (day: string, checked: boolean) => draft.change({ days: WEEKDAY_NAMES.filter(name => name === day ? checked : days.includes(name)) });
  return <section className="space-y-4">
    <div><h3 className="text-base font-semibold">Çalışma günleri</h3>
      <p className="mt-1 text-sm text-muted-foreground">Seçilmeyen günler hafta tatili sayılır; o günkü çalışma hafta tatili çarpanıyla hesaplanır.</p></div>
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <form noValidate className="space-y-4" onSubmit={async event => { event.preventDefault(); setFailed(!await run()); }}>
      <fieldset disabled={pending} className="flex flex-wrap gap-x-6 gap-y-3">
        <legend className="sr-only">Çalışma günleri</legend>
        {WEEKDAY_NAMES.map(day => <Label key={day} className="flex items-center gap-2 font-normal">
          <Checkbox checked={days.includes(day)} onCheckedChange={checked => toggle(day, checked === true)} />{day}
        </Label>)}
      </fieldset>
      {days.length === 0 && <p role="alert" className="text-sm text-destructive">En az bir çalışma günü seçin.</p>}
      <SettingsSaveBar dirty={draft.dirty} saving={pending} valid={days.length > 0} label="Çalışma günlerini kaydet" onCancel={draft.reset} />
    </form>
  </section>;
}
