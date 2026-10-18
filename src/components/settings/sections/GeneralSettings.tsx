import { useEffect, useRef, useState } from "react";
import { useGeneralSettings } from "./hooks";
import { CompanyInfoForm, SystemSettingsForm } from "./general";
import { generalSchema, generalPayload, type GeneralValues } from "./general/generalForm";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { SettingsSaveBar } from "../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../SettingsFormState";

export function GeneralSettings() {
  const { settings, loading, saving, saveSettings } = useGeneralSettings();
  const draft = useSettingsDraft<GeneralValues>({
    companyName: settings?.companyName ?? "", taxNumber: settings?.taxNumber ?? "", address: settings?.address ?? "",
    email: settings?.email ?? "", phone: settings?.phone ?? "", website: settings?.website ?? "", currency: settings?.currency ?? "TRY",
    darkMode: settings?.darkMode ?? false, notifications: settings?.notificationsEnabled ?? true,
  });
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const parsed = generalSchema.safeParse(draft.values);
  const errors: Partial<Record<keyof GeneralValues, string>> = {};
  if (!parsed.success && (touched || draft.dirty)) for (const issue of parsed.error.issues) errors[issue.path[0] as keyof GeneralValues] = issue.message;
  useSettingsFormState("general", draft.dirty, saving);
  const savedTheme = useRef(false);
  useEffect(() => { if (!loading) savedTheme.current = settings?.darkMode ?? false; }, [settings?.darkMode, loading]);
  useEffect(() => { if (!loading) document.documentElement.classList.toggle("dark", draft.values.darkMode); }, [draft.values.darkMode, loading]);
  useEffect(() => () => { document.documentElement.classList.toggle("dark", savedTheme.current); }, []);
  if (loading) return <SectionSkeleton label="Genel ayarlar yükleniyor" />;
  return <form noValidate className="space-y-6" onSubmit={async event => {
    event.preventDefault(); setTouched(true);
    if (!parsed.success) { document.getElementById(String(parsed.error.issues[0]?.path[0]))?.focus(); return; }
    const success = await saveSettings(generalPayload(parsed.data));
    setFailed(!success);
    if (success) { savedTheme.current = parsed.data.darkMode; draft.reset(); setTouched(false); }
  }}>
    {!settings && <p role="status" className="text-sm text-muted-foreground">Henüz şirket bilgisi kaydedilmemiş. Bu proje için şirket bilgilerini girin.</p>}
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <fieldset disabled={saving} className="min-w-0 space-y-6">
      <CompanyInfoForm values={draft.values} change={draft.change} errors={errors} />
      <SystemSettingsForm values={draft.values} change={draft.change} />
    </fieldset>
    <SettingsSaveBar dirty={draft.dirty} saving={saving} valid={parsed.success} label="Genel ayarları kaydet" onCancel={() => { draft.reset(); setFailed(false); setTouched(false); }} />
  </form>;
}
