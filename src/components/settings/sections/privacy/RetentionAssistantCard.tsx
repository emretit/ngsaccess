import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SettingsSaveBar } from "../../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../../SettingsFormState";

export const retentionDaysSchema = z.number().int("Tam gün sayısı girin.").min(1825, "En az 1825 gün girin.").max(3650, "En fazla 3650 gün girin.").nullable();

export const RETENTION_EFFECT = "Okuma kayıtları puantaj, bordro ve raporların hesap kaynağıdır; süre dolunca daha eski dönemler yeniden hesaplanamaz ve raporlanamaz. Gerekli raporları önce dışa aktarın; yasal saklama süresini (5–10 yıl) yasal danışmanınıza sorun.";

export function needsRetentionConfirmation(current: number | null, next: number | null): boolean {
  return next !== null && (current === null || next < current);
}

export function needsUnmaskConfirmation(current: boolean, next: boolean): boolean {
  return current && !next;
}

function RetentionForm({ projectId, days }: { projectId: Id<"projects">; days: number | null }) {
  const draft = useSettingsDraft({ unlimited: days === null, days: String(days ?? 1825) });
  const [failed, setFailed] = useState(false);
  const [confirmation, setConfirmation] = useState<number | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const mutate = useMutation(api.privacyRetention.setCardReadingRetention).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.privacyRetention.getRetentionAndAssistant, { projectId: args.projectId });
    if (current) store.setQuery(api.privacyRetention.getRetentionAndAssistant, { projectId: args.projectId }, { ...current, cardReadingRetentionDays: args.days });
  });
  const parsed = retentionDaysSchema.safeParse(draft.values.unlimited ? null : Number(draft.values.days));
  const persist = async (next: number | null) => { await mutate({ projectId, days: next }); draft.reset(); setFailed(false); };
  const save = useAsyncAction(persist, { success: "Saklama süresi kaydedildi" });
  useSettingsFormState("privacy-retention", draft.dirty, save.pending || confirmPending);
  return <section className="min-w-0 space-y-4">
    <h3 className="text-base font-semibold">Okuma kayıtlarını saklama süresi</h3>
    <p className="text-sm text-muted-foreground">Süre dolan kart okuma kayıtları günlük iş ile kademeli ve kalıcı silinir. Süresiz seçeneğinde otomatik silme yapılmaz.</p>
    <p className="text-sm text-warning">{RETENTION_EFFECT}</p>
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <form className="space-y-4" noValidate onSubmit={async event => {
      event.preventDefault();
      if (!parsed.success) return;
      if (needsRetentionConfirmation(days, parsed.data)) setConfirmation(parsed.data);
      else setFailed(!await save.run(parsed.data));
    }}>
      <fieldset disabled={save.pending || confirmPending} className="min-w-0 space-y-4">
        <FormFieldWrapper htmlFor="retention-mode" label="Saklama seçimi">
          <select id="retention-mode" className="h-10 w-full rounded-md border border-control bg-background px-3 text-sm" value={draft.values.unlimited ? "unlimited" : "custom"} onChange={event => draft.change({ unlimited: event.target.value === "unlimited" })}>
            <option value="unlimited">Süresiz</option><option value="custom">Özel gün sayısı</option>
          </select>
        </FormFieldWrapper>
        {!draft.values.unlimited && <FormFieldWrapper htmlFor="retention-days" label="Gün sayısı" hint="1825–3650 arasında tam gün sayısı. Puantaj kaynağı olduğu için yasal saklama süresi en az 5 yıldır." error={!parsed.success ? parsed.error.issues[0]?.message : undefined}>
          <Input id="retention-days" type="number" min={1825} max={3650} step={1} value={draft.values.days} onChange={event => draft.change({ days: event.target.value })} />
        </FormFieldWrapper>}
      </fieldset>
      <SettingsSaveBar dirty={draft.dirty} saving={save.pending || confirmPending} valid={parsed.success} label="Saklama süresini kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
    </form>
    <ConfirmDestructive open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }} title="Otomatik silme etkinleştirilsin mi?" objectName="Bu projenin kart okuma kayıtları" effects={[`${confirmation ?? 1825} günden eski kayıtlar günlük iş ile kalıcı silinir.`, RETENTION_EFFECT, "Silinen kayıtlar geri alınamaz."]} confirmLabel="Süreyi kaydet" onConfirm={async () => {
      if (confirmation === null) return;
      setConfirmPending(true);
      try { await persist(confirmation); notify.success("Saklama süresi kaydedildi"); }
      catch (error: unknown) { setFailed(true); throw error; }
      finally { setConfirmPending(false); }
    }} />
  </section>;
}

function AssistantForm({ projectId, enabled }: { projectId: Id<"projects">; enabled: boolean }) {
  const draft = useSettingsDraft({ enabled });
  const [failed, setFailed] = useState(false);
  const [confirmUnmask, setConfirmUnmask] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const mutate = useMutation(api.privacyRetention.setAssistantMasking).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.privacyRetention.getRetentionAndAssistant, { projectId: args.projectId });
    if (current) store.setQuery(api.privacyRetention.getRetentionAndAssistant, { projectId: args.projectId }, { ...current, aiMaskNames: args.enabled });
  });
  const save = useAsyncAction(async () => { await mutate({ projectId, enabled: draft.values.enabled }); draft.reset(); }, { success: "Asistan gizliliği kaydedildi" });
  const busy = save.pending || confirmPending;
  useSettingsFormState("privacy-assistant", draft.dirty, busy);
  return <section className="min-w-0 space-y-4 border-t pt-6">
    <h3 className="text-base font-semibold">Asistan gizliliği</h3>
    <p className="text-sm text-muted-foreground">Çalışan adları aynı sohbet verisinde Personel 1, Personel 2… olarak gösterilir. Kendi sorunuza yazdığınız adlar değiştirilmez. Ayarlarınızı yasal danışmanınıza doğrulatın.</p>
    <p className="text-sm text-warning">Kapatırsanız çalışan adları üçüncü taraf yapay zeka servisine gönderilir.</p>
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <form className="space-y-4" onSubmit={async event => { event.preventDefault(); if (needsUnmaskConfirmation(enabled, draft.values.enabled)) { setConfirmUnmask(true); return; } setFailed(!await save.run()); }}>
      <FormFieldWrapper htmlFor="assistant-mask" label="Çalışan isimlerini maskele" className="flex items-center gap-3 space-y-0">
        <Switch id="assistant-mask" checked={draft.values.enabled} disabled={busy} onCheckedChange={next => draft.change({ enabled: next })} />
      </FormFieldWrapper>
      <SettingsSaveBar dirty={draft.dirty} saving={busy} label="Asistan gizliliğini kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
    </form>
    <ConfirmDestructive open={confirmUnmask} onOpenChange={setConfirmUnmask} title="Çalışan adlarının maskesi kaldırılsın mı?"
      objectName="Asistan gizliliği" effects={["Çalışan adları üçüncü taraf yapay zeka servisine gönderilir.", "Ayarlarınızı yasal danışmanınıza doğrulatın."]}
      confirmLabel="Maskeyi kapat" onConfirm={async () => {
        setConfirmPending(true);
        try { await mutate({ projectId, enabled: false }); draft.reset(); setFailed(false); notify.success("Asistan gizliliği kaydedildi"); }
        catch (error: unknown) { setFailed(true); throw error; }
        finally { setConfirmPending(false); }
      }} />
  </section>;
}

export function RetentionAssistantCard({ projectId }: { projectId: Id<"projects"> }) {
  const settings = useQuery(api.privacyRetention.getRetentionAndAssistant, { projectId });
  if (settings === undefined) return <SectionSkeleton label="Saklama ve asistan ayarları yükleniyor" />;
  return <div className="min-w-0 space-y-6"><RetentionForm key={`${projectId}-retention`} projectId={projectId} days={settings.cardReadingRetentionDays} /><AssistantForm key={`${projectId}-assistant`} projectId={projectId} enabled={settings.aiMaskNames} /></div>;
}
