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
  </section>;
}
