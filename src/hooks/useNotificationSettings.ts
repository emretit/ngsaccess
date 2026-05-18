import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface NotificationSettingsInput {
  emailNotifications?: boolean;
  lateNotifications?: boolean;
  reportNotifications?: boolean;
  systemNotifications?: boolean;
}

export function useNotificationSettings() {
  const { toast } = useToast();
  const { projectId } = useActiveProject();

  const notificationSettings = useQuery(api.settings.getNotification, { projectId });
  const upsertNotification = useMutation(api.settings.upsertNotification);

  const saveNotificationSettings = async (settings: NotificationSettingsInput) => {
    try {
      await upsertNotification({ ...settings, projectId });
      toast({
        title: "Bildirim ayarları kaydedildi",
        description: "Bildirim tercihleri başarıyla güncellendi",
      });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Bildirim ayarları kaydedilirken hata oluştu",
        variant: "destructive",
      });
    }
  };

  return {
    notificationSettings: notificationSettings ?? null,
    isLoading: notificationSettings === undefined,
    saveNotificationSettings,
    isSaving: false,
  };
}
