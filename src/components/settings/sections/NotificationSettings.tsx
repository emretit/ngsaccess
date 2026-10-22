import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Switch } from "@/components/ui/switch";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { SettingsSaveBar } from "../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../SettingsFormState";

export function NotificationSettings({ onComplete }: { onComplete?: () => void }) {
  const { notificationSettings: saved, isLoading, saveNotificationSettings, isSaving } = useNotificationSettings();
  const draft = useSettingsDraft({ emailNotifications: saved?.emailNotifications ?? true, lateNotifications: saved?.lateNotifications ?? true,
    reportNotifications: saved?.reportNotifications ?? true, systemNotifications: saved?.systemNotifications ?? true });
  const [failed, setFailed] = useState(false);
  useSettingsFormState("notifications", draft.dirty, isSaving);
  if (isLoading) return <SectionSkeleton label="Bildirim ayarları yükleniyor" />;
  return <form className="space-y-6" onSubmit={async event => {
    event.preventDefault();
    const success = await saveNotificationSettings(draft.values); setFailed(!success);
    if (success) { draft.reset(); onComplete?.(); }
  }}>
    <p className="text-sm text-muted-foreground">Bu tercihler seçili projeye aittir. Tercih kaydı gönderim testi veya teslimat garantisi değildir.</p>
    <p className="rounded border p-3 text-sm">Alarm ve cihaz arızası e-postalarının açılması, alıcıları ve önem eşiği yalnızca <Link className="underline" to="/alarms?settings=notifications">Alarm merkezi → Bildirim ayarları</Link> bölümünden yönetilir. Son gönderim sonucu ve test e-postası da oradadır; yönetici yetkisi gerekir.</p>
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <fieldset disabled={isSaving} className="space-y-4">
      {([
        ["lateNotifications", "Geç kalma bildirimleri", "Geç kalma olayları için tercih."],
        ["reportNotifications", "Rapor bildirimleri", "Proje rapor bildirim tercihi; kişisel hatırlatmadan ayrıdır."],
        ["systemNotifications", "Sistem olayları için bildirim tercihi", "Sistem olaylarına ait proje tercihidir. Genel bölümündeki eski kayıt bu tercihi değiştirmez; bu kayıt henüz gönderimi durdurmaz."],
      ] as const).map(([key, label, hint]) => <FormFieldWrapper key={key} inline htmlFor={key} label={label} hint={hint}>
        <Switch checked={draft.values[key]} onCheckedChange={checked => draft.change({ [key]: checked })} />
      </FormFieldWrapper>)}
    </fieldset>
    <SettingsSaveBar dirty={draft.dirty} saving={isSaving} label="Bildirim tercihlerini kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
  </form>;
}
