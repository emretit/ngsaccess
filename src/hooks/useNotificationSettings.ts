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
  const { projectId, loading: projectLoading } = useActiveProject();

  const notificationSettings = useQuery(
    api.settings.getNotification,
    !projectLoading && projectId ? { projectId } : "skip",
  );
  const upsertNotification = useMutation(api.settings.upsertNotification);

  const saveNotificationSettings = async (settings: NotificationSettingsInput) => {
    if (!projectId) {
      toast({
        title: "Hata",
        description: "Önce bir proje seçin.",
        variant: "destructive",
      });
      return;
    }
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
    isLoading:
      projectLoading || (!!projectId && notificationSettings === undefined),
    saveNotificationSettings,
    isSaving: false,
  };
}
