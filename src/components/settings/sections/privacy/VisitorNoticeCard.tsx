import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Input } from "@/components/ui/input";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SettingsSaveBar } from "../../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../../SettingsFormState";

export const visitorNoticeSchema = z.object({
  visitorKvkkUrl: z.string().trim().max(2048, "Bağlantı en fazla 2048 karakter olabilir."),
  visitorKvkkVersion: z.string().trim().max(100, "Sürüm en fazla 100 karakter olabilir."),
}).superRefine((value, ctx) => {
  if (Boolean(value.visitorKvkkUrl) !== Boolean(value.visitorKvkkVersion)) {
    ctx.addIssue({ code: "custom", path: [value.visitorKvkkUrl ? "visitorKvkkVersion" : "visitorKvkkUrl"], message: "Bağlantı ve sürümü birlikte girin veya ikisini de boş bırakın." });
  }
  if (value.visitorKvkkUrl) {
    try {
      const url = new URL(value.visitorKvkkUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { ctx.addIssue({ code: "custom", path: ["visitorKvkkUrl"], message: "Geçerli bir http veya https bağlantısı girin." }); }
  }
});

const visitorRetentionSchema = z.number().int("Tam gün sayısı girin.").min(30, "En az 30 gün girin.").max(3650, "En fazla 3650 gün girin.").nullable();

export function VisitorRetentionForm({ projectId }: { projectId: Id<"projects"> }) {
  const saved = useQuery(api.privacyRetention.getVisitorRetention, { projectId });
  const mutate = useMutation(api.privacyRetention.setVisitorRetention);
  const draft = useSettingsDraft({ days: String(saved?.visitorRetentionDays ?? "") });
  const [failed, setFailed] = useState(false);
  const parsed = visitorRetentionSchema.safeParse(draft.values.days.trim() === "" ? null : Number(draft.values.days));
  const needsPreview = parsed.success && parsed.data !== null
    && (saved?.visitorRetentionDays == null || parsed.data < saved.visitorRetentionDays);
  const preview = useQuery(api.privacyRetention.previewVisitorRetention,
    needsPreview && parsed.success && parsed.data !== null ? { projectId, days: parsed.data } : "skip");
  const save = useAsyncAction(mutate, { success: "Ziyaretçi kayıtlarını saklama süresi kaydedildi", error: "Saklama süresi kaydedilemedi" });
  useSettingsFormState("visitor-retention", draft.dirty, save.pending);
  if (saved === undefined) return <SectionSkeleton label="Ziyaretçi saklama süresi yükleniyor" />;
  return <form className="space-y-4 border-t pt-4" noValidate onSubmit={async event => {
    event.preventDefault();
    if (!parsed.success || (needsPreview && preview === undefined)) return;
    const success = await save.run({ projectId, days: parsed.data });
    setFailed(!success);
    if (success) draft.reset();
  }}>
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <FormFieldWrapper htmlFor="visitor-retention-days" label="Ziyaretçi kayıtlarını saklama süresi (gün)"
      hint="Pasif ziyaretçi kayıtları belirtilen gün sonra silinir (boş = silinmez). Boş bırakıldığında otomatik silme kapalıdır."
      error={!parsed.success ? parsed.error.issues[0]?.message : undefined}>
      <Input id="visitor-retention-days" type="number" min={30} max={3650} step={1} value={draft.values.days} disabled={save.pending}
        onChange={event => draft.change({ days: event.target.value })} />
    </FormFieldWrapper>
    {needsPreview && <p role="status" className="text-sm text-muted-foreground">{preview === undefined
      ? "Silinecek kayıtlar hesaplanıyor…"
      : `Bu süreye göre ${preview.capped ? "en az " : ""}${preview.count} pasif ziyaretçi kaydı günlük temizlikte kalıcı olarak silinecek.${preview.capped ? " Sayım sınırlıdır; daha fazla kayıt olabilir." : ""}`}</p>}
    <SettingsSaveBar dirty={draft.dirty} saving={save.pending} valid={parsed.success && (!needsPreview || preview !== undefined)}
      label="Ziyaretçi saklama süresini kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
  </form>;
}

export function VisitorNoticeCard({ projectId }: { projectId: Id<"projects"> }) {
  const saved = useQuery(api.privacyRetention.getVisitorNotice, { projectId });
  const save = useMutation(api.privacyRetention.setVisitorNotice);
  const draft = useSettingsDraft({ visitorKvkkUrl: saved?.visitorKvkkUrl ?? "", visitorKvkkVersion: saved?.visitorKvkkVersion ?? "" });
  const [failed, setFailed] = useState(false);
  const action = useAsyncAction(save, { success: "Ziyaretçi aydınlatma metni ayarı kaydedildi", error: "Ziyaretçi aydınlatma metni ayarı kaydedilemedi" });
  useSettingsFormState("visitor-notice", draft.dirty, action.pending);
  const parsed = visitorNoticeSchema.safeParse(draft.values);
  if (saved === undefined) return <SectionSkeleton label="Ziyaretçi aydınlatma metni ayarı yükleniyor" />;
  return <section className="space-y-4" aria-label="Ziyaretçi aydınlatma metni">
    <div><h3 className="text-base font-medium">Ziyaretçi aydınlatma metni</h3><p className="mt-1 text-sm text-muted-foreground">Kurumunuzun onayladığı metnin bağlantısını ve sürümünü girin. Ziyaretçi formunda bu bağlantı gösterilir; burada hukuki metin oluşturulmaz.</p></div>
    <form className="space-y-4" noValidate onSubmit={async event => {
      event.preventDefault();
      if (!parsed.success) { document.getElementById(String(parsed.error.issues[0]?.path[0]))?.focus(); return; }
      const success = await action.run({ projectId, ...parsed.data }); setFailed(!success); if (success) draft.reset();
    }}>
      <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
      <fieldset disabled={action.pending} className="space-y-4">
        {([['visitorKvkkUrl', 'Metin bağlantısı (URL)'], ['visitorKvkkVersion', 'Metin sürümü']] as const).map(([key, label]) => <FormFieldWrapper key={key} htmlFor={key} label={label} error={draft.dirty && !parsed.success ? parsed.error.issues.find(issue => issue.path[0] === key)?.message : undefined}>
          <Input type={key === "visitorKvkkUrl" ? "url" : "text"} maxLength={key === "visitorKvkkUrl" ? 2048 : 100} value={draft.values[key]} onChange={event => draft.change({ [key]: event.target.value })} />
        </FormFieldWrapper>)}
      </fieldset>
      <SettingsSaveBar dirty={draft.dirty} saving={action.pending} valid={parsed.success} label="Ziyaretçi metni ayarını kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
    </form>
    <VisitorRetentionForm key={projectId} projectId={projectId} />
  </section>;
}
