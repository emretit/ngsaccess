import React from "react";
import { useGeneralSettings, useDarkMode } from "./hooks";
import { CompanyInfoForm, SystemSettingsForm, FormSubmitButton } from "./general";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";

export function GeneralSettings() {
  const { settings, loading, saving, saveSettings } = useGeneralSettings();
  const { isDarkMode, applyDarkMode } = useDarkMode();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      companyName: String(formData.get("companyName") ?? "").trim(),
      taxNumber: String(formData.get("taxNumber") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      currency: String(formData.get("currency") ?? "").trim() || null,
      systemLanguage: formData.get('language') as string || undefined,
      timezone: formData.get('timezone') as string || undefined,
      dateFormat: formData.get('dateFormat') as string || undefined,
      darkMode: isDarkMode,
      workingHoursStart: formData.get('workingHoursStart') as string || undefined,
      workingHoursEnd: formData.get('workingHoursEnd') as string || undefined,
      notificationsEnabled: formData.get('notifications') === 'on',
    };

    const success = await saveSettings(data);

    if (success) {
      applyDarkMode(isDarkMode);
    }
  };

  const handleDarkModeChange = (enabled: boolean) => {
    applyDarkMode(enabled);
  };

  if (loading) {
    return <SectionSkeleton label="Ayarlar yükleniyor" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={saving} className="space-y-6">
      <CompanyInfoForm company={settings} />

      <SystemSettingsForm
        settings={settings}
        isDarkMode={isDarkMode}
        onDarkModeChange={handleDarkModeChange}
      />

      </fieldset>
      <FormSubmitButton saving={saving} />
    </form>
  );
}
