import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GeneralSettings } from '../types/generalSettings';
import { convertFormDataToSettings, validateSettings } from '../utils/settingsUtils';

export const useGeneralSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('general_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
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
      const settingsData = convertFormDataToSettings(formData);
      
      // Validate settings
      const errors = validateSettings(settingsData);
      if (errors.length > 0) {
        toast({
          title: "❌ Doğrulama Hatası",
          description: errors.join(', '),
          variant: "destructive",
        });
        return false;
      }

      // Save general settings
      const { data, error } = await supabase
        .from('general_settings')
        .upsert(settingsData, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) throw error;

      // Save to companies table
      if (settingsData.company_name) {
        const { error: companyError } = await supabase
          .from('companies')
          .upsert({
            name: settingsData.company_name,
            project_id: 1
          }, {
            onConflict: 'name'
          });

        if (companyError) {
          console.error('Company save error:', companyError);
        }
      }

      setSettings(data);
      
      toast({
        title: "✅ Ayarlar güncellendi",
        description: "Şirket bilgileri ve ayarlar başarıyla kaydedildi.",
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
    loading,
    saving,
    saveSettings,
    refreshSettings: loadSettings
  };
};