import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";

interface MailSettingsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  fromEmail?: string;
  fromName?: string;
  isActive?: boolean;
}

export function useMailSettings() {
  const { projectId, loading: projectLoading, isAdmin } = useActiveProjectScope();

  const mailSettings = useQuery(
    api.settings.getMail,
    !projectLoading && isAdmin && projectId ? { projectId } : "skip",
  );
  const upsertMail = useMutation(api.settings.upsertMail);

  const { run: saveMailSettings, pending: isSaving } = useAsyncAction(async (settings: MailSettingsInput) => {
    if (!isAdmin || !projectId || projectLoading || mailSettings === undefined) throw new Error("Ayarlar yüklenmeden kaydedilemez. Önce bir proje seçin.");
    await upsertMail({ ...settings, projectId });
  }, { success: "Ayarlar kaydedildi", error: "Ayarlar kaydedilemedi" });

  return {
    mailSettings: mailSettings ?? null,
    isLoading: projectLoading || (!!projectId && mailSettings === undefined),
    saveMailSettings,
    isSaving,
  };
}
