import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GeneralSettings, CompanyInfo } from '../types/generalSettings';
import { convertFormDataToSettings, validateSettings, convertFormDataToCompany } from '../utils/settingsUtils';

export const useGeneralSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('general_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error loading settings:', settingsError);
      }

      if (settingsData) {
        setSettings(settingsData);
      }

      // Load company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', 1)
        .limit(1)
        .single();

      if (companyError && companyError.code !== 'PGRST116') {
        console.error('Error loading company:', companyError);
      }

      if (companyData) {
        setCompany(companyData);
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (formData: FormData) => {
    try {
      setSaving(true);
      
      // Convert form data
      const settingsData = convertFormDataToSettings(formData);
      const companyData = convertFormDataToCompany(formData);
      
      // Validate company data
      const errors = validateSettings(settingsData);
      if (errors.length > 0) {
        toast({
          title: "❌ Doğrulama Hatası",
          description: errors.join(', '),
          variant: "destructive",
        });
        return false;
      }

      // Save or update company info using upsert
      const { data: savedCompany, error: companyError } = await supabase
        .from('companies')
        .upsert({
          ...companyData,
          project_id: 1
        }, {
          onConflict: 'project_id'
        })
        .select()
        .single();
        
      if (companyError) throw companyError;

      // Save or update system settings
      let savedSettings;
      const { data: existingSettings } = await supabase
        .from('general_settings')
        .select('*')
        .limit(1)
        .single();

      const settingsPayload = {
        company_name: companyData.name, // Required field
        system_language: settingsData.system_language,
        timezone: settingsData.timezone,
        date_format: settingsData.date_format,
        dark_mode: settingsData.dark_mode,
        notifications_enabled: settingsData.notifications_enabled,
        working_hours_start: settingsData.working_hours_start,
        working_hours_end: settingsData.working_hours_end,
      };

      if (existingSettings) {
        // Update existing settings
        const { data, error } = await supabase
          .from('general_settings')
          .update(settingsPayload)
          .eq('id', existingSettings.id)
          .select()
          .single();
          
        if (error) throw error;
        savedSettings = data;
      } else {
        // Insert new settings
        const { data, error } = await supabase
          .from('general_settings')
          .insert(settingsPayload)
          .select()
          .single();
          
        if (error) throw error;
        savedSettings = data;
      }

      setSettings(savedSettings);
      setCompany(savedCompany);
      
      toast({
        title: "✅ Ayarlar güncellendi",
        description: "Şirket bilgileri ve sistem ayarları başarıyla kaydedildi.",
      });

      return true;
    } catch (error) {
      console.error('Settings save error:', error);
      toast({
        title: "❌ Hata",
        description: "Ayarlar güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    company,
    loading,
    saving,
    saveSettings,
    refreshSettings: loadSettings
  };
};