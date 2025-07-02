
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProjectAccess } from "./useProjectAccess";

interface MailSettings {
  id?: string;
  project_id?: number;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_secure?: boolean;
  from_email?: string;
  from_name?: string;
  is_active?: boolean;
}

export function useMailSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projectIds } = useProjectAccess();

  const { data: mailSettings, isLoading } = useQuery({
    queryKey: ['mail-settings', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return null;
      
      const { data, error } = await supabase
        .from('mail_settings')
        .select('*')
        .in('project_id', projectIds)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: projectIds.length > 0
  });

  const saveMailSettings = useMutation({
    mutationFn: async (settings: MailSettings) => {
      const projectId = projectIds[0];
      if (!projectId) throw new Error('Proje bulunamadı');

      const { data, error } = await supabase
        .from('mail_settings')
        .upsert({
          ...settings,
          project_id: projectId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
      toast({
        title: "Mail ayarları kaydedildi",
        description: "Mail yapılandırması başarıyla güncellendi",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Hata",
        description: error.message || "Mail ayarları kaydedilirken hata oluştu",
        variant: "destructive",
      });
    }
  });

  return {
    mailSettings,
    isLoading,
    saveMailSettings: saveMailSettings.mutate,
    isSaving: saveMailSettings.isPending
  };
}
