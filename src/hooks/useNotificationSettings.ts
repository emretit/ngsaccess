import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";

interface NotificationSettingsInput {
  emailNotifications?: boolean;
  lateNotifications?: boolean;
  reportNotifications?: boolean;
  systemNotifications?: boolean;
}

export function useNotificationSettings() {
  const { projectId, loading: projectLoading } = useActiveProjectScope();
  const isAdmin = usePermissions().can("admin.manage");

  const notificationSettings = useQuery(
    api.settings.getNotification,
    !projectLoading && isAdmin && projectId ? { projectId } : "skip",
  );
  const upsertNotification = useMutation(api.settings.upsertNotification);

  const { run: saveNotificationSettings, pending: isSaving } = useAsyncAction(async (settings: NotificationSettingsInput) => {
    if (!isAdmin || !projectId || projectLoading || notificationSettings === undefined) throw new Error("Ayarlar yüklenmeden kaydedilemez. Önce bir proje seçin.");
    await upsertNotification({ ...settings, projectId });
  }, { success: "Ayarlar kaydedildi", error: "Ayarlar kaydedilemedi" });

  return {
    notificationSettings: notificationSettings ?? null,
    isLoading:
      projectLoading || (!!projectId && notificationSettings === undefined),
    saveNotificationSettings,
    isSaving,
  };
}
