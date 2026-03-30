// @ts-nocheck

import React from "react";
import { useGeneralSettings, useDarkMode } from "./hooks";
import { CompanyInfoForm, SystemSettingsForm, FormSubmitButton } from "./general";

export function GeneralSettings() {
  const { settings, company, loading, saving, saveSettings } = useGeneralSettings();
  const { isDarkMode, applyDarkMode } = useDarkMode();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const success = await saveSettings(formData);
    
    if (success) {
      // Apply dark mode setting immediately
      const darkModeValue = formData.get('darkMode') === 'on';
      applyDarkMode(darkModeValue);
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
        settings={settings} 
        isDarkMode={isDarkMode}
        onDarkModeChange={handleDarkModeChange}
      />

      <FormSubmitButton saving={saving} />
    </form>
  );
}
