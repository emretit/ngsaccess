
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProjectAccess } from "./useProjectAccess";

interface NotificationSettings {
  id?: string;
  project_id?: number;
  email_notifications?: boolean;
  late_notifications?: boolean;
  report_notifications?: boolean;
  system_notifications?: boolean;
}

export function useNotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projectIds } = useProjectAccess();

  const { data: notificationSettings, isLoading } = useQuery({
    queryKey: ['notification-settings', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return null;
      
      const { data, error } = await supabase
        .from('notification_settings')
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

  const saveNotificationSettings = useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      const projectId = projectIds[0];
      if (!projectId) throw new Error('Proje bulunamadı');

      const { data, error } = await supabase
        .from('notification_settings')
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
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: "Bildirim ayarları kaydedildi",
        description: "Bildirim tercihleri başarıyla güncellendi",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Hata",
        description: error.message || "Bildirim ayarları kaydedilirken hata oluştu",
        variant: "destructive",
      });
    }
  });

  return {
    notificationSettings,
    isLoading,
    saveNotificationSettings: saveNotificationSettings.mutate,
    isSaving: saveNotificationSettings.isPending
  };
}
