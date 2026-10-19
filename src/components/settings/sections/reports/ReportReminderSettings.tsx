import { useState } from "react";
import { z } from "zod";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsSaveBar } from "../../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../../SettingsFormState";
import { REPORT_TEMPLATES } from "./reportTypes";

const reminderSchema = z.object({ enabled: z.boolean(), email: z.string(), reportType: z.enum(["sgk", "overtime", "attendance", "department"]) })
  .superRefine((value, ctx) => {
    if (value.enabled && !z.string().email().safeParse(value.email.trim()).success) ctx.addIssue({ code: "custom", path: ["email"], message: "Geçerli bir e-posta adresi girin" });
  });
type ReminderValues = z.infer<typeof reminderSchema>;
const selectStyle = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

export function ReportReminderSettings() {
  const [scope, setScope] = useState("active");
  return <ReminderForm key={scope} scope={scope} setScope={setScope} />;
}
function ReminderForm({ scope, setScope }: { scope: string; setScope: (scope: string) => void }) {
  const { projectId: activeProjectId, projectIds, activeProject } = useActiveProjectScope();
  const projectId = scope === "all" ? undefined : activeProjectId;
  const saved = useQuery(api.reports.getReportSchedule, { projectId });
  const save = useMutation(api.reports.saveReportSchedule);
  const savedType = reminderSchema.shape.reportType.safeParse(saved?.reportType);
  const draft = useSettingsDraft<ReminderValues>({ email: saved?.email ?? "", enabled: saved?.enabled ?? false, reportType: savedType.success ? savedType.data : "sgk" });
  const [failed, setFailed] = useState(false);
  useUnsavedChangesGuard(draft.dirty);
  const [nextScope, setNextScope] = useState<string | null>(null);
  const parsed = reminderSchema.safeParse(draft.values);
  const error = !parsed.success ? parsed.error.issues[0]?.message : undefined;
  const action = useAsyncAction(async (payload: ReminderValues) => {
    if (saved === undefined) throw new Error("Hatırlatma ayarlarının yüklenmesini bekleyin");
    await save({ projectId, ...payload, email: payload.email.trim() });
  }, { success: "Kişisel rapor hatırlatması kaydedildi", error: "Hatırlatma kaydedilemedi" });
  useSettingsFormState("report-reminder", draft.dirty, action.pending);
  return <section className="min-w-0 space-y-4 border-t pt-6">
    <div><h3 className="text-base font-semibold">Kişisel e-posta hatırlatması</h3>
      <p className="mt-1 text-sm text-muted-foreground">Her ayın ilk günü size rapor hatırlatması ve kapsam bilgisi gönderilir. Dosya eki gönderilmez; raporu bu ekrandan indirirsiniz.</p></div>
    <FormFieldWrapper htmlFor="reminder-scope" label="Hatırlatma kapsamı">
      <select className={selectStyle} value={scope} disabled={action.pending} onChange={event => { const next = event.target.value; if (draft.dirty) setNextScope(next); else setScope(next); }}>
        <option value="active">{activeProject?.name ?? "Aktif proje"}</option>
        {projectIds.length > 1 && <option value="all">Tüm erişilebilir projeler</option>}
      </select>
    </FormFieldWrapper>
    {saved === undefined ? <SectionSkeleton label="Hatırlatma ayarları yükleniyor" /> : <form className="space-y-4" noValidate onSubmit={async event => {
      event.preventDefault();
      if (!parsed.success) { document.getElementById("reminder-email")?.focus(); return; }
      const success = await action.run(parsed.data); setFailed(!success); if (success) draft.reset();
    }}>
      <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
      <fieldset disabled={action.pending} className="min-w-0 space-y-4">
        <FormFieldWrapper inline htmlFor="reminder-enabled" label="Aylık rapor hatırlatmasını al">
          <Switch checked={draft.values.enabled} onCheckedChange={enabled => draft.change({ enabled })} />
        </FormFieldWrapper>
        <FormFieldWrapper htmlFor="reminder-type" label="Hatırlatılacak rapor türü">
          <select className={selectStyle} value={draft.values.reportType} onChange={event => {
            const type = reminderSchema.shape.reportType.safeParse(event.target.value); if (type.success) draft.change({ reportType: type.data });
          }}>{REPORT_TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.label}</option>)}</select>
        </FormFieldWrapper>
        {draft.values.enabled && <FormFieldWrapper htmlFor="reminder-email" label="Alıcı e-posta adresi *" error={error}>
          <Input type="email" value={draft.values.email} onChange={event => draft.change({ email: event.target.value })} />
        </FormFieldWrapper>}
      </fieldset>
      <SettingsSaveBar dirty={draft.dirty} saving={action.pending} valid={parsed.success} label="Hatırlatmayı kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
      <p role="status" className="text-sm text-muted-foreground break-words">Kayıtlı durum: {saved?.enabled ? `Açık — ${saved.email}` : "Kapalı"}</p>
    </form>}
    <ReminderScopeConfirmation open={nextScope !== null} onOpenChange={open => { if (!open) setNextScope(null); }} onConfirm={() => { if (nextScope !== null) setScope(nextScope); }} />
  </section>;
}

export function ReminderScopeConfirmation({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kapsam değiştirilsin mi?</AlertDialogTitle><AlertDialogDescription>Kapsamı değiştirirseniz kaydedilmemiş hatırlatma taslağı silinir.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Düzenlemeye dön</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Kapsamı değiştir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>;
}
