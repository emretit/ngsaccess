import React from "react";
import { useGeneralSettings, useDarkMode } from "./hooks";
import { CompanyInfoForm, SystemSettingsForm, FormSubmitButton } from "./general";
import type { CompanyInfo } from "./types/generalSettings";

export function GeneralSettings() {
  const { settings, loading, saving, saveSettings } = useGeneralSettings();
  const { isDarkMode, applyDarkMode } = useDarkMode();

  // Map settings to CompanyInfo for CompanyInfoForm
  const company: CompanyInfo | null = settings ? {
    name: settings.companyName ?? "",
    tax_number: settings.taxNumber,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    website: settings.website,
    currency: settings.currency,
    logo_url: settings.logoUrl,
  } : null;

  // Map settings to GeneralSettings type for SystemSettingsForm
  const generalSettings = settings ? {
    company_name: settings.companyName ?? "",
    system_language: settings.systemLanguage,
    timezone: settings.timezone,
    date_format: settings.dateFormat,
    dark_mode: settings.darkMode,
    notifications_enabled: settings.notificationsEnabled,
    working_hours_start: settings.workingHoursStart,
    working_hours_end: settings.workingHoursEnd,
  } : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      companyName: formData.get('companyName') as string || undefined,
      taxNumber: formData.get('taxNumber') as string || undefined,
      address: formData.get('address') as string || undefined,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      website: formData.get('website') as string || undefined,
      currency: formData.get('currency') as string || undefined,
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
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Ayarlar yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <CompanyInfoForm company={company} />
      
      <SystemSettingsForm 
        settings={generalSettings} 
        isDarkMode={isDarkMode}
        onDarkModeChange={handleDarkModeChange}
      />

      <FormSubmitButton saving={saving} />
    </form>
  );
}
